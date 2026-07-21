import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const adminEmails = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);
type Json = Record<string, unknown>;
type Post = {
  objective?: string;
  format?: "single" | "carousel";
  pillar?: string;
  theme?: string;
  target_audience?: string;
  hook?: string;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  alt_text?: string;
  visual_brief?: string;
  slides?: Array<Record<string, unknown>>;
};

function reply(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function parseJson(text: string): Json {
  const clean = text
    .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
    .replace(/\s*\x60\x60\x60$/i, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA nao retornou JSON valido.");
  return JSON.parse(clean.slice(start, end + 1));
}
function hashtags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  return Array.from(new Set(list.map(String).map((v) => v.trim()).filter(Boolean)
    .map((v) => v.startsWith("#") ? v : "#" + v))).slice(0, 12);
}
function normalize(raw: Post, fallback: Post, audience: string) {
  const format = raw.format === "carousel" || fallback.format === "carousel"
    ? "carousel" : "single";
  return {
    objective: String(raw.objective || fallback.objective || "awareness"),
    format,
    pillar: String(raw.pillar || fallback.pillar || "Educacao sobre prospeccao"),
    theme: String(raw.theme || fallback.theme || "Prospeccao mais previsivel"),
    target_audience: String(raw.target_audience || fallback.target_audience || audience),
    hook: String(raw.hook || fallback.hook || "Prospectar nao precisa consumir o seu dia."),
    caption: String(raw.caption || fallback.caption || ""),
    hashtags: hashtags(raw.hashtags || fallback.hashtags),
    cta: String(raw.cta || fallback.cta || "Teste a Zuno Prospect."),
    alt_text: String(raw.alt_text || fallback.alt_text || "Conteudo da Zuno sobre prospeccao."),
    visual_brief: String(raw.visual_brief || fallback.visual_brief || "Visual premium da Zuno, fundo escuro e destaques verdes."),
    slides: Array.isArray(raw.slides) ? raw.slides.slice(0, 8)
      : (Array.isArray(fallback.slides) ? fallback.slides.slice(0, 8) : []),
  };
}
function lines(parts: Array<string | number>) {
  return parts.join("\n");
}
async function gemini(prompt: string, key: string): Promise<Json> {
  const model = Deno.env.get("INSTAGRAM_CONTENT_MODEL") || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const result = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        model + ":generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 12000,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    if (!result.ok) {
      throw new Error("Gemini falhou (" + result.status + "): " +
        (await result.text()).slice(0, 500));
    }
    const data = await result.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "").join("") || "";
    return parseJson(text);
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ success: false, error: "Metodo nao permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const aiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini_API");
    if (!url || !anon || !service) throw new Error("Supabase nao configurado.");
    if (!aiKey) throw new Error("GOOGLE_GEMINI_API_KEY nao configurada.");

    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, service);
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return reply({ success: false, error: "Sessao invalida." }, 401);

    const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: auth.user.id });
    const allowed = adminFlag === true ||
      adminEmails.has(String(auth.user.email || "").trim().toLowerCase());
    if (!allowed) return reply({ success: false, error: "Acesso exclusivo para administradores." }, 403);

    const input = await req.json().catch(() => ({}));
    const requestedPlan = Array.isArray(input.post_plan)
      ? input.post_plan.slice(0, 7)
      : [];
    const count = requestedPlan.length ||
      Math.min(7, Math.max(1, Number(input.count || 1)));
    const requestedFormat = ["single", "carousel"].includes(input.format)
      ? input.format : "mixed";
    const objective = String(input.objective || "awareness");
    const theme = String(input.theme || "").trim();

    const { data: settings, error: settingsError } = await admin
      .from("instagram_content_settings").select("*").eq("singleton", true).single();
    if (settingsError) throw new Error("Configuracoes indisponiveis: " + settingsError.message);

    const { data: recent } = await admin.from("instagram_content_posts")
      .select("theme, hook, pillar, created_at")
      .order("created_at", { ascending: false }).limit(20);
    const brand = {
      brand_name: settings.brand_name,
      product_description: settings.product_description,
      target_audience: settings.target_audience,
      brand_voice: settings.brand_voice,
      content_pillars: settings.content_pillars,
    };

    const strategy = await gemini(lines([
      "Voce e o AGENTE ESTRATEGISTA DE CONTEUDO da Zuno Prospect.",
      "Crie estrategia para " + count + " post(s) de Instagram.",
      "MARCA:", JSON.stringify(brand, null, 2),
      "OBJETIVO: " + objective,
      "FORMATO: " + requestedFormat,
      "TEMA: " + (theme || "escolha com base nos pilares"),
      "PLANO EDITORIAL POR DATA: " + JSON.stringify(requestedPlan, null, 2),
      requestedPlan.length
        ? "Siga a ordem, o tema, o formato e o objetivo de cada item do plano editorial. Cada conceito deve corresponder a uma data."
        : "Distribua os conceitos conforme o objetivo informado.",
      "A Zuno encontra empresas por cidade e nicho e cria abordagens contextualizadas.",
      "Nao invente numeros, clientes, depoimentos ou resultados.",
      "Evite promessas garantidas e linguagem de guru.",
      "No objetivo de conversao, prefira uma acao iniciada pelo usuario: enviar DM, responder Story ou usar o link da bio.",
      "Comentario com palavra-chave e resposta privada so podem ser prometidos quando o brief confirmar que a integracao oficial de mensagens esta ativa.",
      "Nunca proponha DM fria automatica, reuniao ou agendamento. O interessado segue para WhatsApp e depois para o site apenas para cadastro ou pagamento.",
      "Nao repita: " + JSON.stringify(recent || []),
      "Retorne somente JSON com exatamente " + count + " concepts:",
      '{"batch_strategy":"","concepts":[{"objective":"","format":"single|carousel","pillar":"","theme":"","target_audience":"","hook":"","angle":"","cta":"","visual_brief":""}]}',
    ]), aiKey);
    const concepts = Array.isArray(strategy.concepts)
      ? strategy.concepts.slice(0, count) : [];
    if (!concepts.length) throw new Error("O estrategista nao criou conceitos validos.");

    const creation = await gemini(lines([
      "Voce e o AGENTE CRIADOR DE CONTEUDO da Zuno Prospect.",
      "MARCA:", JSON.stringify(brand, null, 2),
      "CONCEITOS:", JSON.stringify(concepts, null, 2),
      "Crie posts em portugues do Brasil, naturais, claros e praticos.",
      "Legenda com gancho, corpo escaneavel e CTA. Maximo 12 hashtags especificas.",
      "Nao invente estatisticas, cases ou funcionalidades.",
      "Para conversao, o CTA deve levar a uma DM iniciada pelo usuario ou ao link da bio; depois do interesse, a conversa continua no WhatsApp.",
      "Nao prometa resposta automatica a comentario enquanto essa integracao nao estiver confirmada no brief.",
      "Carousel deve ter 5 a 8 slides com title e body; single deve ter slides vazio.",
      "Visual premium escuro, verde e branco. Nao diga que foi criado por IA.",
      "Retorne somente JSON:",
      '{"posts":[{"objective":"","format":"single|carousel","pillar":"","theme":"","target_audience":"","hook":"","caption":"","hashtags":["#exemplo"],"cta":"","alt_text":"","visual_brief":"","slides":[{"title":"","body":""}]}]}',
    ]), aiKey);
    const created = Array.isArray(creation.posts)
      ? creation.posts.slice(0, concepts.length) : [];
    if (!created.length) throw new Error("O criador nao retornou posts validos.");

    let reviewed = created;
    let reviewSummary = "Mantida a versao do agente criador.";
    try {
      const review = await gemini(lines([
        "Rejeite CTA que prometa DM fria, resposta automatica nao conectada, reuniao ou agendamento.",
        "Quando o objetivo for conversao, preserve a sequencia Instagram iniciado pelo usuario -> WhatsApp -> site.",
        "Voce e o AGENTE REVISOR DE MARCA E CONVERSAO da Zuno Prospect.",
        "POSTS:", JSON.stringify(created, null, 2),
        "Revise clareza, naturalidade, veracidade, CTA e hashtags.",
        "Remova cliches de IA, promessas, dados inventados e agressividade.",
        "Preserve formato, estrutura completa e quantidade.",
        'Retorne JSON: {"review_summary":"","posts":[]}',
      ]), aiKey);
      if (Array.isArray(review.posts) && review.posts.length) {
        reviewed = review.posts.slice(0, created.length);
      }
      reviewSummary = String(review.review_summary || "Conteudo revisado.");
    } catch (error) {
      console.warn("[instagram-content-agent] Revisor indisponivel.", error);
    }

    const batchId = crypto.randomUUID();
    const rows = concepts.map((concept, index) => {
      const creatorPost = (created[index] || concept) as Post;
      const finalPost = (reviewed[index] || creatorPost) as Post;
      const planned = requestedPlan[index] || {};
      const plannedDate = String(planned.scheduled_at || "");
      const validPlannedDate = plannedDate && !Number.isNaN(new Date(plannedDate).getTime())
        ? new Date(plannedDate).toISOString()
        : null;
      const post = normalize(
        finalPost,
        { ...(concept as Post), ...creatorPost },
        settings.target_audience
      );
      // Editorial calendars always require explicit human approval.
      // Automatic mode remains available only for isolated, non-calendar runs.
      const automatic = settings.posting_mode === "automatic" && !requestedPlan.length;
      return {
        ...post,
        batch_id: batchId,
        created_by: auth.user.id,
        status: automatic ? "scheduled" : "pending_review",
        scheduled_at: validPlannedDate || (automatic
          ? new Date(Date.now() + (index + 1) * 86400000).toISOString()
          : null),
        agent_trace: {
          strategy: concept,
          creator: creatorPost,
          reviewer: finalPost,
          review_summary: reviewSummary,
          model: Deno.env.get("INSTAGRAM_CONTENT_MODEL") || "gemini-2.5-flash",
        },
        metadata: {
          requested_theme: theme || null,
          requested_objective: objective,
          requested_format: requestedFormat,
          planned_funnel_stage: planned.funnel_stage || null,
          planned_pillar: planned.pillar || null,
          posting_mode: settings.posting_mode,
        },
      };
    });

    const { data: inserted, error: insertError } = await admin
      .from("instagram_content_posts").insert(rows).select("*");
    if (insertError) throw new Error("Falha ao salvar posts: " + insertError.message);

    return reply({
      success: true,
      batch_id: batchId,
      review_summary: reviewSummary,
      posts: inserted || [],
    });
  } catch (error) {
    console.error("[instagram-content-agent]", error);
    return reply({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});