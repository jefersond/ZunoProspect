import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ANALYSIS_PROMPT_VERSION, buildVerifiedFacts, sanitizeSellerProfile, type RawLeadForAnalysis } from "../_shared/lead-analysis.ts";
import { runAnalysisPipeline } from "../_shared/analysis-pipeline.ts";
import { buildRefineFailure } from "../_shared/refine-failure.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}


function fail(requestId: string, code: string, status: number, message: string, extra: Record<string, unknown> = {}) {
  const built = buildRefineFailure(requestId, code, status, message, extra);
  return json(built.body, built.status);
}

function text(v: unknown, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mapeia a linha do lead para os campos usados na análise.
 * Pixel/GTM/GA/"WhatsApp no site" ficam de fora de propósito: a inspeção de HTML está suspensa (hotfix #55).
 */
function toRawLead(row: any, context: any = {}): RawLeadForAnalysis & { foco: string } {
  return {
    nome: text(row?.nome || row?.name || row?.company_name, "Empresa"),
    nicho: text(row?.nicho || row?.niche || context?.nicho || context?.niche, ""),
    cidade: text(row?.cidade || row?.city || context?.cidade || context?.city, ""),
    endereco: text(row?.endereco || row?.address) || null,
    website: text(row?.website || row?.site) || null,
    instagram: text(row?.instagram_url || row?.instagram) || null,
    email: text(row?.email) || null,
    phone: text(row?.whatsapp_number || row?.telefone || row?.phone) || null,
    rating: num(row?.rating),
    reviews: num(row?.total_reviews ?? row?.reviews),
    status: text(row?.status, "novo"),
    notas: text(row?.notas) || null,
    foco: text(row?.foco || row?.focus || context?.focus, ""),
  };
}

async function logEvent(admin: any, userId: string, eventType: string, eventData: any) {
  try {
    await admin.rpc("log_app_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_event_data: eventData,
      p_ip_address: null,
      p_user_agent: null,
    });
  } catch (_) {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error_message: "Método não permitido." }, 405);

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const started = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const GEMINI_KEY = (
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API") ||
      Deno.env.get("Gemini_API") ||
      Deno.env.get("VITE_GEMINI_API_KEY") || ""
    ).trim().replace(/^["']|["']$/g, "");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
      return fail(requestId, "REFINE_CONFIGURATION_MISSING", 503, "O serviço de refinamento está temporariamente indisponível.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return fail(requestId, "REFINE_SESSION_MISSING", 401, "Sua sessão expirou. Entre novamente para continuar.");

    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: authError } = await auth.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return fail(requestId, "REFINE_SESSION_INVALID", 401, "Sua sessão expirou. Entre novamente para continuar.");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") return fail(requestId, "REFINE_INPUT_INVALID", 400, "Dados inválidos para análise.");

    const payloadLead = requestData.lead && typeof requestData.lead === "object" ? requestData.lead : requestData;
    const rawLeadId = requestData.leadId || requestData.lead_id || payloadLead?.id;
    const leadId = typeof rawLeadId === "string" && UUID_RE.test(rawLeadId.trim()) ? rawLeadId.trim() : null;
    if (!leadId) return fail(requestId, "REFINE_LEAD_REFERENCE_INVALID", 409, "O lead ainda não está pronto para refinamento. Atualize a lista e tente novamente.");

    // 1) Perfil do assinante: sem serviço/oferta não existe mensagem comercial honesta. Falha ANTES de qualquer custo.
    const profile = sanitizeSellerProfile(requestData.seller_profile);
    const earlyFailure = evaluatePreconditions({ profile, stage: "nao_contatado", existingPlan: null, replaceExisting: true });
    if (earlyFailure) {
      return fail(requestId, earlyFailure.code, earlyFailure.status, earlyFailure.message, earlyFailure.code === "REFINE_PROFILE_REQUIRED" ? { missing_fields: earlyFailure.missing } : {});
    }

    // 2) Créditos (regra existente, inalterada)
    let usageInfo: any = null;
    try {
      const { data } = await auth.rpc("get_current_user_usage");
      usageInfo = data?.[0] || null;
    } catch (_) {}
    const email = String(user.email || "").trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.has(email) || usageInfo?.is_admin === true || usageInfo?.role === "admin";
    const remaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 3);
    const unlimited = isAdmin || Number(usageInfo?.ai_limit ?? 0) >= 999999;
    if (!unlimited && remaining <= 0) return fail(requestId, "REFINE_PERMISSION_DENIED", 402, "Você não tem análises de IA disponíveis.");

    // 3) Lead do próprio usuário
    let rows: any[] | null = null;
    try {
      const { data } = await admin.rpc("get_lead_decrypted_by_id", { p_lead_id: leadId, p_user_id: user.id });
      if (Array.isArray(data)) rows = data;
    } catch (_) {}
    if (!rows?.length) {
      const { data } = await admin.from("leads").select("*").eq("id", leadId).eq("user_id", user.id).maybeSingle();
      if (data) rows = [data];
    }
    if (!rows?.length) return fail(requestId, "REFINE_LEAD_NOT_FOUND", 409, "O lead não foi encontrado na sua conta. Atualize a lista e tente novamente.");

    const row = rows[0];
    const rawLead = toRawLead(row, requestData.search_context || requestData.context || {});
    if (rawLead.foco === "zuno_internal_prospecting" && !isAdmin) {
      return fail(requestId, "REFINE_PERMISSION_DENIED", 403, "Este tipo de análise não está disponível para sua conta.");
    }

    if (!GEMINI_KEY) {
      return fail(requestId, "REFINE_CONFIGURATION_MISSING", 503, "O serviço de refinamento está temporariamente indisponível. Seu crédito não foi consumido.");
    }

    const facts = buildVerifiedFacts(rawLead);
    const outcome = await runAnalysisPipeline(
      {
        apiKey: GEMINI_KEY,
        fetchFn: fetch as never,
        now: () => new Date().toISOString(),
        persist: async (values) => {
          const { data: saved, error: saveError } = await admin
            .from("leads")
            .update({
              diagnostico_bullets: values.diagnostico_bullets,
              probabilidade_conversao: null,
              plano_prospeccao: values.plano_prospeccao,
              ai_analise_gerada_em: values.ai_analise_gerada_em,
              ai_used_fallback: false,
              ai_fallback_reason: null,
            })
            .eq("id", leadId)
            .eq("user_id", user.id)
            .select("id, ai_analise_gerada_em");
          return !saveError && Boolean(saved?.length);
        },
        consumeCredit: async () => {
          const { data: ok, error } = await admin.rpc("increment_ai_usage", { p_user_id: user.id });
          return !error && ok === true;
        },
      },
      {
        leadId,
        requestId,
        profile,
        rawLead,
        existingPlan: row.plano_prospeccao,
        replaceExisting: requestData.replace_existing === true,
        isAdmin,
      },
    );

    // Telemetria separa a cobrança do PROVEDOR (Gemini) do crédito INTERNO do assinante.
    const billingLog = {
      request_id: requestId,
      leadId,
      prompt_version: ANALYSIS_PROMPT_VERSION,
      stage_of_lead: facts.etapa_do_historico,
      http_attempts: outcome.telemetry?.http_attempts ?? 0,
      generations_with_content: outcome.telemetry?.generations_with_content ?? 0,
      model_used: outcome.telemetry?.model_used ?? null,
      finish_reason: outcome.telemetry?.finish_reason ?? null,
      usage: outcome.telemetry?.usage ?? null,
      attempts: outcome.telemetry?.attempts ?? [],
      provider_billing: outcome.ok ? outcome.telemetry.billing : outcome.providerBilling,
      internal_credit_charged: outcome.internalCreditCharged,
      duration_ms: Date.now() - started,
    };

    if (!outcome.ok) {
      console.warn(JSON.stringify({ module: "analisar-lead-ia", stage: "pipeline", code: outcome.code, ...billingLog }));
      if (outcome.providerBilling !== "not_called") {
        await logEvent(admin, user.id, "ai_analysis_failed_handled", { ...billingLog, code: outcome.code });
      }
      return fail(requestId, outcome.code, outcome.status, outcome.message, outcome.extra ?? {});
    }

    await logEvent(admin, user.id, "ai_analysis_completed", {
      ...billingLog,
      replaced_existing_plan: Boolean(row.plano_prospeccao),
      preserved_days: outcome.preservedDays,
      demoted_days: outcome.demotedDays,
    });

    return json({
      ...outcome.payload,
      success: true,
      request_id: requestId,
      used_fallback: false,
      preserved_days: outcome.preservedDays,
      timing: { total_ms: Date.now() - started },
      ...(outcome.creditWarning ? { credit_warning: outcome.creditWarning } : {}),
    });
  } catch (err) {
    console.error(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "global", error: err instanceof Error ? err.message : String(err) }));
    return fail(requestId, "REFINE_UNKNOWN_ERROR", 500, "Não foi possível refinar o conteúdo neste momento. Tente novamente.");
  }
});
