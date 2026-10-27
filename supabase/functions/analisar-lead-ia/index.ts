import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CONFLICT_BODY,
  IN_PROGRESS_BODY,
  REFINE_MODELS,
  SAVE_FAILED_BODY,
  okAlready,
  runGuardedRefine,
  summarizeProviderError,
  type RefineStore,
} from "../_shared/refine-provider-guard.ts";
import {
  buildAnalysisPrompt,
  buildDiagnosticoBullets,
  buildPersistedPayload,
  buildVerifiedFacts,
  evaluatePreconditions,
  nextHistory,
  runGeminiAnalysis,
  toStoredDay,
  validateAnalysis,
  type GeminiTelemetry,
  type RawLeadForAnalysis,
  type SellerProfile,
  type StoredDay,
  type ValidatedAnalysis,
  type VerifiedFacts,
} from "../_shared/lead-analysis.ts";
import { loadSellerProfileForUser } from "../_shared/seller-profile-store.ts";

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

// Mantém exatamente o formato de requisição que já está em produção (sem thinkingConfig, 7000 tokens, 18 s):
// trocar modelo, prazo ou raciocínio é decisão separada, a ser tomada com amostras reais.
const PROVIDER_TIMEOUT_MS = 18_000;
const PROVIDER_MAX_OUTPUT_TOKENS = 7_000;
const MAX_PROVIDER_ATTEMPTS = REFINE_MODELS.length;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Converte a linha do lead (cadastro público) nos fatos que a análise pode usar. Nada de sinais de HTML (#55). */
function leadFromRow(raw: any, context: any = {}): RawLeadForAnalysis {
  return {
    nome: str(raw?.nome || raw?.name || raw?.business_name || raw?.company_name),
    nicho: str(raw?.nicho || raw?.category || raw?.categoria || raw?.niche || raw?.segmento || context?.nicho || context?.niche),
    cidade: str(raw?.cidade || raw?.city || context?.cidade || context?.city),
    endereco: str(raw?.endereco || raw?.address || raw?.formatted_address) || null,
    website: str(raw?.website || raw?.site || raw?.url || raw?.website_url) || null,
    instagram: str(raw?.instagram_url || raw?.instagram) || null,
    email: str(raw?.email) || null,
    phone: str(raw?.whatsapp_number || raw?.whatsapp || raw?.phone || raw?.telefone || raw?.formatted_phone_number) || null,
    rating: num(raw?.rating ?? raw?.avaliacao ?? raw?.stars),
    reviews: num(raw?.total_reviews ?? raw?.reviews ?? raw?.user_ratings_total ?? raw?.review_count),
    status: str(raw?.status) || "novo",
    notas: str(raw?.notas) || null,
  };
}

/** Resultado do prompt v6 já validado e no formato gravado (`plano_prospeccao_7dias`), pronto para o guarda de gravação. */
interface V6Result {
  plano_prospeccao_7dias: StoredDay[];
  validated: ValidatedAnalysis;
  warnings: string[];
  demotedDays: number[];
  telemetry: GeminiTelemetry;
}

type V6Outcome = { ok: true; analysis: V6Result; model: string } | { ok: false; error: string };

async function callGeminiV6(apiKey: string, facts: VerifiedFacts, profile: SellerProfile, requestData: any, requestId: string): Promise<V6Outcome> {
  // `max_provider_attempts` só pode REDUZIR as tentativas (ex.: 1 em verificações pontuais); nunca aumenta.
  const requested = Math.trunc(Number(requestData?.max_provider_attempts));
  const maxAttempts = Number.isFinite(requested) && requested >= 1 ? Math.min(requested, MAX_PROVIDER_ATTEMPTS) : MAX_PROVIDER_ATTEMPTS;

  const run = await runGeminiAnalysis({
    apiKey,
    prompt: buildAnalysisPrompt(facts, profile),
    fetchFn: fetch as never,
    models: [...REFINE_MODELS],
    maxAttempts,
    timeoutMs: PROVIDER_TIMEOUT_MS,
    request: { thinkingLevel: null, maxOutputTokens: PROVIDER_MAX_OUTPUT_TOKENS },
  });

  // Telemetria por análise (modelos tentados, status, duração implícita e tokens), sem dados do lead nem chaves.
  console.info(JSON.stringify({
    module: "analisar-lead-ia", request_id: requestId, stage: "provider_summary",
    attempts: run.telemetry.attempts.map((a) => ({ model: a.model, status: a.http_status, outcome: a.outcome })),
    model_used: run.telemetry.model_used, finish_reason: run.telemetry.finish_reason, usage: run.telemetry.usage,
  }));

  if (!run.ok) return { ok: false, error: summarizeProviderError(run.error, 160) };

  const validation = validateAnalysis(run.raw, { channels: facts.canais_disponiveis, profile, stage: facts.etapa_do_historico, facts });
  if (!validation.ok) return { ok: false, error: `${run.model}:invalid_output:${validation.issues.join("|").slice(0, 200)}` };

  return {
    ok: true,
    model: run.model,
    analysis: {
      plano_prospeccao_7dias: validation.analysis.plano.map(toStoredDay),
      validated: validation.analysis,
      warnings: validation.warnings,
      demotedDays: validation.demoted_days,
      telemetry: run.telemetry,
    },
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
      return json({ success: false, request_id: requestId, error_code: "REFINE_CONFIGURATION_MISSING", error_message: "O serviço de refinamento está temporariamente indisponível." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ success: false, request_id: requestId, error_code: "REFINE_SESSION_MISSING", error_message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: authError } = await auth.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return json({ success: false, request_id: requestId, error_code: "REFINE_SESSION_INVALID", error_message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") return json({ success: false, request_id: requestId, error_code: "REFINE_INPUT_INVALID", error_message: "Dados inválidos para análise." }, 400);

    const payloadLead = requestData.lead && typeof requestData.lead === "object" ? requestData.lead : requestData;
    const rawLeadId = requestData.leadId || requestData.lead_id || payloadLead?.id;
    const leadId = typeof rawLeadId === "string" && UUID_RE.test(rawLeadId.trim()) ? rawLeadId.trim() : null;
    if (!leadId) return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_REFERENCE_INVALID", error_message: "O lead ainda não está pronto para refinamento. Atualize a lista e tente novamente." }, 409);

    let usageInfo: any = null;
    try {
      const { data } = await auth.rpc("get_current_user_usage");
      usageInfo = data?.[0] || null;
    } catch (_) {}
    const email = String(user.email || "").trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.has(email) || usageInfo?.is_admin === true || usageInfo?.role === "admin";
    const remaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 3);
    const unlimited = isAdmin || Number(usageInfo?.ai_limit ?? 0) >= 999999;
    if (!unlimited && remaining <= 0) return json({ success: false, request_id: requestId, error_code: "REFINE_PERMISSION_DENIED", error_message: "Você não tem análises de IA disponíveis." }, 402);

    let rows: any[] | null = null;
    try {
      const { data } = await admin.rpc("get_lead_decrypted_by_id", { p_lead_id: leadId, p_user_id: user.id });
      if (Array.isArray(data)) rows = data;
    } catch (_) {}
    if (!rows?.length) {
      const { data } = await admin.from("leads").select("*").eq("id", leadId).eq("user_id", user.id).maybeSingle();
      if (data) rows = [data];
    }
    if (!rows?.length) return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_NOT_FOUND", error_message: "O lead não foi encontrado na sua conta. Atualize a lista e tente novamente." }, 409);

    if (str(rows[0]?.foco) === "zuno_internal_prospecting" && !isAdmin) {
      return json({ success: false, request_id: requestId, error_code: "REFINE_PERMISSION_DENIED", error_message: "Este tipo de análise não está disponível para sua conta." }, 403);
    }

    // Pré-condições ANTES de qualquer reserva, chamada de IA ou crédito: perfil comercial do assinante completo e lead sem recusa.
    const leadRow = leadFromRow(rows[0], requestData.search_context || requestData.context || {});
    const facts = buildVerifiedFacts(leadRow);
    const profile = await loadSellerProfileForUser(admin, user.id); // perfil salvo do próprio usuário; o corpo é ignorado
    const blocked = evaluatePreconditions({ profile, stage: facts.etapa_do_historico, existingPlan: null, replaceExisting: true });
    if (blocked) {
      return json({
        success: false,
        request_id: requestId,
        error_code: blocked.code,
        category: "validation_error",
        retryable: false,
        safe_message: blocked.message,
        error_message: blocked.message,
        ...("missing" in blocked ? { missing_fields: blocked.missing } : {}),
        credit_consumed: false,
        saved: false,
      }, blocked.status);
    }

    let responsePayload: Record<string, unknown> | null = null;

    // Exclusão mútua por lead: duas requisições simultâneas (duas abas, clique duplo) não geram nem cobram duas vezes.
    const store: RefineStore = {
      read: async () => {
        const { data } = await admin
          .from("leads")
          .select("status, notas, ai_fallback_reason, updated_at, ai_analise_gerada_em, ai_used_fallback, plano_prospeccao")
          .eq("id", leadId)
          .eq("user_id", user.id)
          .maybeSingle();
        return data
          ? { status: data.status ?? null, notas: data.notas ?? null, reason: data.ai_fallback_reason ?? null, updatedAt: data.updated_at ?? null, generatedAt: data.ai_analise_gerada_em ?? null, usedFallback: data.ai_used_fallback ?? null, plan: data.plano_prospeccao ?? null }
          : null;
      },
      claim: async (prevReason, lockValue, nowIso) => {
        let query = admin.from("leads").update({ ai_fallback_reason: lockValue, updated_at: nowIso }).eq("id", leadId).eq("user_id", user.id);
        query = prevReason === null ? query.is("ai_fallback_reason", null) : query.eq("ai_fallback_reason", prevReason);
        const { data, error } = await query.select("id");
        return !error && data?.length === 1;
      },
      release: async (lockValue, restoreReason) => {
        await admin
          .from("leads")
          .update({ ai_fallback_reason: restoreReason, updated_at: new Date().toISOString() })
          .eq("id", leadId)
          .eq("user_id", user.id)
          .eq("ai_fallback_reason", lockValue);
      },
    };

    const run = await runGuardedRefine<V6Result>({
      requestId,
      isAdmin,
      store,
      callProvider: async (): Promise<V6Outcome> => GEMINI_KEY
        ? await callGeminiV6(GEMINI_KEY, facts, profile, requestData, requestId)
        : { ok: false, error: "gemini_key_missing" },
      validate: okAlready,
      persist: async (analysis, model, ctx) => {
        const generatedAt = new Date().toISOString();
        const built = buildPersistedPayload({
          leadId, requestId, model, generatedAt, facts, profile,
          analysis: analysis.validated,
          days: analysis.plano_prospeccao_7dias,
          history: nextHistory(ctx.previousPlan, generatedAt),
          warnings: analysis.warnings,
          telemetry: analysis.telemetry,
        });
        // Mantém qualquer outro dado já guardado no plano e sobrepõe só o que a nova análise define.
        const previousObject = ctx.previousPlan && typeof ctx.previousPlan === "object" && !Array.isArray(ctx.previousPlan) ? ctx.previousPlan as Record<string, unknown> : {};
        responsePayload = { ...previousObject, ...built };
        let update = admin
          .from("leads")
          .update({
            diagnostico_bullets: buildDiagnosticoBullets(analysis.validated.diagnostico),
            // O prompt v6 não produz nota de fechamento: o valor antigo deixa de valer e nada é inventado no lugar.
            probabilidade_conversao: null,
            plano_prospeccao: responsePayload,
            ai_analise_gerada_em: generatedAt,
            ai_used_fallback: false,
            ai_fallback_reason: null, // limpa a reserva na mesma gravação
          })
          .eq("id", leadId)
          .eq("user_id", user.id)
          .eq("ai_fallback_reason", ctx.lockValue); // só grava se a reserva ainda for desta requisição
        // Compare-and-set nas colunas escalares lidas agora: se o status (ex.: opt-out) ou a análise mudou entre a
        // última leitura e a gravação, nenhuma linha é alterada e a atualização é recusada.
        update = ctx.expected.status === null ? update.is("status", null) : update.eq("status", ctx.expected.status);
        update = ctx.expected.generatedAt === null ? update.is("ai_analise_gerada_em", null) : update.eq("ai_analise_gerada_em", ctx.expected.generatedAt);
        const { data: saved, error: saveError } = await update.select("id, ai_analise_gerada_em");
        return !saveError && Boolean(saved?.length);
      },
      charge: async () => {
        const { data: ok, error } = await admin.rpc("increment_ai_usage", { p_user_id: user.id });
        return !error && ok === true;
      },
    });

    if (run.status === "in_progress") {
      await logEvent(admin, user.id, "ai_analysis_duplicate_ignored", { request_id: requestId, leadId, reason: "in_progress", deducted_credit: false });
      return json(IN_PROGRESS_BODY(requestId), 409);
    }

    if (run.status === "conflict" || run.status === "expired") {
      const key = run.status === "expired" ? "expired" : run.reason;
      await logEvent(admin, user.id, "ai_analysis_failed_handled", { request_id: requestId, leadId, stage: "conflict", reason: key, saved: false, deducted_credit: false });
      return json(CONFLICT_BODY(requestId, key), 409);
    }

    if (run.status === "lead_not_found") {
      return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_NOT_FOUND", error_message: "O lead não foi encontrado na sua conta. Atualize a lista e tente novamente." }, 409);
    }

    if (run.status === "already_current") {
      await logEvent(admin, user.id, "ai_analysis_duplicate_ignored", { request_id: requestId, leadId, reason: "recent_saved", deducted_credit: false });
      return json({
        success: true,
        request_id: requestId,
        already_current: true,
        saved: true,
        used_fallback: false,
        credit_consumed: false,
        generated_at: run.generatedAt,
      });
    }

    // Sem análise válida do Gemini: nada é gravado (a análise anterior permanece), nenhum crédito é cobrado e o
    // usuário recebe um erro claro. Antes, um texto genérico de reserva era gravado e anunciado como sucesso.
    if (run.status === "provider_failed") {
      await logEvent(admin, user.id, "ai_analysis_failed_handled", {
        request_id: requestId,
        leadId,
        stage: "provider",
        reason: run.reason,
        saved: false,
        deducted_credit: false,
      });
      return json(run.failure.body, run.failure.status);
    }

    if (run.status === "save_failed") {
      await logEvent(admin, user.id, "ai_analysis_failed_handled", { request_id: requestId, stage: "persist_result", internal_code: "REFINE_SAVE_FAILED", deducted_credit: false });
      return json(SAVE_FAILED_BODY(requestId), 503);
    }

    await logEvent(admin, user.id, "ai_analysis_completed", {
      request_id: requestId,
      leadId,
      model: run.model,
      fallback_used: false,
      credit_consumed: run.charged,
      duration_ms: Date.now() - started,
    });

    return json({
      ...(responsePayload ?? {}),
      success: true,
      request_id: requestId,
      saved: true,
      used_fallback: false,
      fallback_reason: null,
      credit_consumed: run.charged,
      preserved_days: run.preserved,
      timing: { total_ms: Date.now() - started },
      ...(run.creditWarning ? { credit_warning: run.creditWarning } : {}),
    });
  } catch (err) {
    console.error(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "global", error: err instanceof Error ? err.message : String(err) }));
    return json({ success: false, request_id: requestId, error_code: "REFINE_UNKNOWN_ERROR", error_message: "Não foi possível refinar o conteúdo neste momento. Tente novamente." }, 500);
  }
});
