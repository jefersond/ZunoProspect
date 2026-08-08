import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function text(v: unknown, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeLead(raw: any, context: any = {}) {
  const nome = text(raw?.nome || raw?.name || raw?.business_name || raw?.company_name || raw?.title, "Empresa");
  const nicho = text(raw?.nicho || raw?.category || raw?.categoria || raw?.niche || raw?.segmento || context?.nicho || context?.niche, "segmento não informado");
  const cidade = text(raw?.cidade || raw?.city || context?.cidade || context?.city, "cidade não informada");
  const website = text(raw?.website || raw?.site || raw?.url || raw?.website_url) || null;
  const phone = text(raw?.whatsapp_number || raw?.whatsapp || raw?.phone || raw?.telefone || raw?.formatted_phone_number) || null;
  const instagram = text(raw?.instagram_url || raw?.instagram) || null;
  const email = text(raw?.email) || null;
  const endereco = text(raw?.endereco || raw?.address || raw?.formatted_address) || null;
  const foco = text(raw?.foco || raw?.focus || context?.focus, "Full Service");
  const rating = num(raw?.rating ?? raw?.avaliacao ?? raw?.stars);
  const reviews = num(raw?.reviews ?? raw?.user_ratings_total ?? raw?.review_count);
  const pais = text(raw?.pais || raw?.country || context?.pais || context?.country, "BR").toUpperCase();
  const canais = Array.isArray(raw?.canaisProspeccao) ? raw.canaisProspeccao.filter((c: unknown) => ["whatsapp", "email", "instagram"].includes(String(c))) : [];

  return {
    nome, nicho, cidade, website, phone, instagram, email, endereco, foco,
    rating, reviews, pais,
    has_meta_pixel: !!raw?.has_meta_pixel,
    has_gtag: !!raw?.has_gtag,
    has_gtm: !!raw?.has_gtm,
    canaisProspeccao: canais,
  };
}

function availableChannels(lead: any) {
  const selected = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["whatsapp", "email", "instagram"];
  const out: string[] = [];
  if (selected.includes("whatsapp") && lead.phone) out.push("whatsapp");
  if (selected.includes("email") && lead.email) out.push("email");
  if (selected.includes("instagram") && lead.instagram) out.push("instagram");
  return out.length ? out : selected;
}

function signals(lead: any) {
  return [
    `Empresa: ${lead.nome}`,
    `Segmento: ${lead.nicho}`,
    `Cidade: ${lead.cidade}`,
    lead.website ? `Site informado: ${lead.website}` : "Site não informado nos dados disponíveis",
    lead.instagram ? `Instagram informado: ${lead.instagram}` : "Instagram não informado nos dados disponíveis",
    lead.phone ? "Telefone/WhatsApp disponível" : "Telefone/WhatsApp não informado nos dados disponíveis",
    lead.email ? `E-mail disponível: ${lead.email}` : null,
    lead.rating !== null ? `Nota no Google: ${lead.rating}` : null,
    lead.reviews !== null ? `Avaliações no Google: ${lead.reviews}` : null,
    lead.has_meta_pixel ? "Meta Pixel detectado" : null,
    lead.has_gtag ? "Google Analytics detectado" : null,
    lead.has_gtm ? "Google Tag Manager detectado" : null,
  ].filter(Boolean).slice(0, 10);
}

function fallbackAnalysis(lead: any) {
  const city = lead.cidade && !lead.cidade.includes("não inform") ? ` em ${lead.cidade}` : "";
  const channels = availableChannels(lead);
  const channelAt = (i: number) => channels[i % channels.length] || "whatsapp";
  const score = Math.min(86, 35 + (lead.website ? 12 : 0) + (lead.instagram ? 10 : 0) + (lead.phone ? 12 : 0) + (lead.email ? 8 : 0) + (lead.rating !== null ? 6 : 0));
  const hasTracking = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;

  const diag = [
    `${lead.nome} atua em ${lead.nicho}${city} e apresenta sinais suficientes para uma abordagem comercial contextualizada.`,
    lead.website || lead.instagram ? "A presença digital disponível cria pontos concretos para iniciar conversa sem depender de uma mensagem genérica." : "Como há poucos ativos digitais informados, a abordagem deve começar por uma pergunta de diagnóstico e não por uma afirmação sobre o negócio.",
    hasTracking ? "Os sinais de mensuração detectados sugerem alguma maturidade digital e abrem espaço para conversar sobre aquisição, conversão e acompanhamento." : "Nos dados disponíveis, não há sinais claros de mensuração; vale validar como a empresa acompanha a origem e a qualidade dos contatos.",
    "O melhor próximo passo é abrir uma conversa curta, validar o processo atual e só depois apresentar uma solução específica para o foco escolhido.",
  ];

  const days = [
    {
      dia: 1,
      canal: channelAt(0),
      acao_sugerida: "Enviar uma abertura curta e contextualizada.",
      mensagem: `Olá, ${lead.nome}, tudo bem? Vi que vocês atuam com ${lead.nicho}${city} e fiquei com uma dúvida rápida: hoje a entrada de novos contatos comerciais acontece de forma previsível ou depende mais de indicação e procura espontânea?`,
      objecao_provavel: "Agora não é prioridade.",
      resposta_sugerida: "Sem problema. Minha ideia é só entender o cenário antes de sugerir qualquer coisa.",
      cta: "Posso te mandar uma observação objetiva?",
    },
    {
      dia: 2,
      canal: channelAt(1),
      acao_sugerida: "Retomar com uma pergunta sobre o processo atual.",
      mensagem: `Oi, ${lead.nome}. Complementando minha mensagem: quando chega uma nova oportunidade, vocês já têm um processo definido para transformar esse interesse em conversa comercial?`,
      objecao_provavel: "Já temos um processo.",
      resposta_sugerida: "Ótimo. Nesse caso, vale comparar apenas um ponto específico para ver se existe espaço de melhoria.",
      cta: "Faz sentido eu te mostrar esse ponto?",
    },
    {
      dia: 3,
      canal: channelAt(2),
      acao_sugerida: "Compartilhar uma ideia prática ligada ao foco selecionado.",
      mensagem: `Pensei em uma ideia simples para ${lead.nicho}: usar os sinais que vocês já têm online para priorizar melhor quem abordar e qual argumento usar na primeira conversa.`,
      objecao_provavel: "Como isso funcionaria?",
      resposta_sugerida: "A lógica é partir de dados reais da empresa e transformar isso em uma abordagem curta, específica e fácil de validar.",
      cta: "Quer que eu te dê um exemplo aplicado ao seu caso?",
    },
    {
      dia: 4,
      canal: "email",
      acao_sugerida: "Enviar e-mail curto com contexto, impacto e pergunta.",
      mensagem: `Assunto: Uma observação sobre ${lead.nome}\n\nOlá! Olhando os dados públicos de ${lead.nome}, vi uma oportunidade de tornar a entrada de novas conversas mais previsível sem começar por uma mudança grande. A ideia é identificar onde existe interesse, priorizar melhor as oportunidades e abrir contato com mais contexto.\n\nFaz sentido eu te enviar um exemplo prático?`,
      objecao_provavel: "Pode mandar mais informações.",
      resposta_sugerida: "Claro. Vou manter objetivo e mostrar apenas o ponto principal para você avaliar rápido.",
      cta: "Posso enviar por aqui?",
    },
    {
      dia: 5,
      canal: channelAt(4),
      acao_sugerida: "Fazer uma pergunta de qualificação.",
      mensagem: `Uma pergunta direta, ${lead.nome}: hoje o maior gargalo está em encontrar novas oportunidades, iniciar a conversa ou acompanhar quem já demonstrou interesse?`,
      objecao_provavel: "Não sei dizer.",
      resposta_sugerida: "Tudo certo. Dá para descobrir olhando onde o processo mais perde tempo ou contatos.",
      cta: "Quer que eu te mande um checklist rápido?",
    },
    {
      dia: 6,
      canal: channelAt(5),
      acao_sugerida: "Tratar a objeção sem pressionar.",
      mensagem: `Se a preocupação for adicionar mais uma ferramenta ou processo, faz sentido. A proposta só vale se reduzir trabalho manual e deixar a rotina comercial mais simples, não o contrário.`,
      objecao_provavel: "Não quero mais uma ferramenta.",
      resposta_sugerida: "Concordo. Só faz sentido se economizar tempo e encaixar no que vocês já fazem hoje.",
      cta: "Quer ver um exemplo antes de decidir?",
    },
    {
      dia: 7,
      canal: channelAt(6),
      acao_sugerida: "Encerrar a cadência de forma respeitosa.",
      mensagem: `Olá, ${lead.nome}. Vou encerrar meus contatos por aqui para não insistir. Se em outro momento fizer sentido revisar como vocês geram e acompanham novas conversas comerciais, fico à disposição.`,
      objecao_provavel: "Talvez mais para frente.",
      resposta_sugerida: "Combinado. Quando fizer sentido, retomamos sem problema.",
      cta: "Posso deixar o contato aberto para depois?",
    },
  ];

  return {
    diagnostico_bullets: diag,
    probabilidade_conversao: score,
    fit_level: score >= 70 ? "alto" : score >= 45 ? "medio" : "baixo",
    commercial_opportunity: "Organizar melhor a geração e o aproveitamento de novas conversas comerciais.",
    probable_pain: "Falta de previsibilidade ou excesso de trabalho manual para gerar e acompanhar oportunidades.",
    why_good_lead: diag.join(" "),
    messages: {
      whatsapp_primary: days.find((d) => d.canal === "whatsapp")?.mensagem || days[0].mensagem,
      instagram: days.find((d) => d.canal === "instagram")?.mensagem || days[1].mensagem,
      email_body: days[3].mensagem,
    },
    plano_prospeccao_7dias: days,
  };
}

const daySchema = {
  type: "object",
  properties: {
    dia: { type: "integer", minimum: 1, maximum: 7 },
    canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
    acao_sugerida: { type: "string", description: "Ação prática e curta para executar o contato." },
    mensagem: { type: "string", description: "Mensagem pronta, natural, específica e sem inventar fatos." },
    objecao_provavel: { type: "string" },
    resposta_sugerida: { type: "string" },
    cta: { type: "string" },
  },
  required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
  additionalProperties: false,
};

const outputSchema = {
  type: "object",
  properties: {
    diagnostico_bullets: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
    probabilidade_conversao: { type: "number", minimum: 0, maximum: 100 },
    fit_level: { type: "string", enum: ["alto", "medio", "baixo"] },
    commercial_opportunity: { type: "string" },
    probable_pain: { type: "string" },
    why_good_lead: { type: "string" },
    messages: {
      type: "object",
      properties: {
        whatsapp_primary: { type: "string" },
        instagram: { type: "string" },
        email_body: { type: "string" },
      },
      required: ["whatsapp_primary", "instagram", "email_body"],
      additionalProperties: false,
    },
    plano_prospeccao_7dias: { type: "array", minItems: 7, maxItems: 7, items: daySchema },
  },
  required: ["diagnostico_bullets", "probabilidade_conversao", "fit_level", "commercial_opportunity", "probable_pain", "why_good_lead", "messages", "plano_prospeccao_7dias"],
  additionalProperties: false,
};

function promptFor(lead: any, requestData: any) {
  const chans = availableChannels(lead).join(", ");
  const sigs = signals(lead).join("\n- ");
  const oferta = text(requestData?.oferta_usuario || requestData?.context?.oferta_usuario, "");
  const publico = text(requestData?.publico_alvo || requestData?.context?.publico_alvo, "");
  const dor = text(requestData?.dor_principal || requestData?.context?.dor_principal, "");
  const objetivo = text(requestData?.objetivo || requestData?.context?.objetivo, "");

  return `Você é um estrategista de vendas B2B brasileiro. Gere uma análise comercial útil e um plano de prospecção de exatamente 7 dias.\n\nDADOS REAIS DO LEAD\n- ${sigs}\n- Foco selecionado: ${lead.foco}\n- Canais permitidos: ${chans}\n${oferta ? `- Oferta do usuário: ${oferta}` : ""}\n${publico ? `- Público-alvo do usuário: ${publico}` : ""}\n${dor ? `- Dor que o usuário quer explorar: ${dor}` : ""}\n${objetivo ? `- Objetivo comercial: ${objetivo}` : ""}\n\nREGRAS\n- Não invente nome de responsável, campanha ativa, concorrente, resultado, faturamento, auditoria ou qualquer dado ausente.\n- Diferencie fato observado de hipótese a validar.\n- Diagnóstico: exatamente 3 ou 4 conclusões curtas e comerciais.\n- Plano: exatamente 7 dias numerados de 1 a 7.\n- Dia 1 abre conversa; dia 2 aprofunda a dor como pergunta; dia 3 entrega ideia prática; dia 4 deve ser um e-mail curto com assunto e corpo; dia 5 qualifica; dia 6 trata objeção; dia 7 encerra com respeito.\n- Cada dia precisa ter todos os campos exigidos no schema, sem campo vazio.\n- Mensagens humanas, curtas, específicas e sem promessa garantida.\n- Use apenas whatsapp, email e instagram.\n- Se um canal não estiver realmente disponível, ainda pode criar a copy como sugestão, mas não afirme que o contato existe.\n- Se o foco for zuno_internal_prospecting, trate como oportunidade comercial e nunca mencione esse nome técnico nem diga que o lead foi encontrado pela Zuno.\n- A mensagem deve vender a próxima conversa, não o serviço inteiro.\n\nRetorne somente o JSON compatível com o schema.`;
}

function normalizeAIResult(ai: any, lead: any) {
  const fb = fallbackAnalysis(lead);
  const result = ai && typeof ai === "object" ? ai : {};
  const bullets = Array.isArray(result.diagnostico_bullets) ? result.diagnostico_bullets.map((x: unknown) => text(x)).filter(Boolean).slice(0, 4) : [];
  result.diagnostico_bullets = bullets.length >= 3 ? bullets : fb.diagnostico_bullets;
  const score = num(result.probabilidade_conversao);
  result.probabilidade_conversao = score === null ? fb.probabilidade_conversao : Math.max(0, Math.min(100, score));
  result.fit_level = ["alto", "medio", "baixo"].includes(result.fit_level) ? result.fit_level : fb.fit_level;
  result.commercial_opportunity = text(result.commercial_opportunity, fb.commercial_opportunity);
  result.probable_pain = text(result.probable_pain, fb.probable_pain);
  result.why_good_lead = text(result.why_good_lead, result.diagnostico_bullets.join(" "));
  result.messages = result.messages && typeof result.messages === "object" ? result.messages : {};
  result.messages.whatsapp_primary = text(result.messages.whatsapp_primary, fb.messages.whatsapp_primary);
  result.messages.instagram = text(result.messages.instagram, fb.messages.instagram);
  result.messages.email_body = text(result.messages.email_body, fb.messages.email_body);

  const byDay = new Map<number, any>();
  if (Array.isArray(result.plano_prospeccao_7dias)) {
    for (const d of result.plano_prospeccao_7dias) {
      const dia = Math.trunc(Number(d?.dia));
      if (dia >= 1 && dia <= 7 && !byDay.has(dia)) byDay.set(dia, d);
    }
  }
  result.plano_prospeccao_7dias = fb.plano_prospeccao_7dias.map((fallbackDay: any) => {
    const d = byDay.get(fallbackDay.dia) || {};
    const canal = ["whatsapp", "email", "instagram"].includes(d.canal) ? d.canal : fallbackDay.canal;
    return {
      dia: fallbackDay.dia,
      canal,
      acao_sugerida: text(d.acao_sugerida, fallbackDay.acao_sugerida),
      mensagem: text(d.mensagem, fallbackDay.mensagem),
      objecao_provavel: text(d.objecao_provavel, fallbackDay.objecao_provavel),
      resposta_sugerida: text(d.resposta_sugerida, fallbackDay.resposta_sugerida),
      cta: text(d.cta, fallbackDay.cta),
    };
  });
  return result;
}

async function callGemini(apiKey: string, lead: any, requestData: any, requestId: string) {
  const prompt = promptFor(lead, requestData);
  let lastError = "";

  for (const model of MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    const started = Date.now();
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 7000,
            responseFormat: {
              text: {
                mimeType: "application/json",
                schema: outputSchema,
              },
            },
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        lastError = `${model}:${response.status}`;
        console.warn(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, status: response.status, duration_ms: Date.now() - started }));
        if ([401, 403].includes(response.status)) break;
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
      if (!rawText) {
        lastError = `${model}:empty`;
        continue;
      }
      const parsed = JSON.parse(rawText);
      console.info(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, status: 200, duration_ms: Date.now() - started, success: true }));
      return { analysis: normalizeAIResult(parsed, lead), model, error: null };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? `${model}:${err.name}:${err.message}` : `${model}:${String(err)}`;
      console.warn(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, error: err instanceof Error ? err.name : typeof err, duration_ms: Date.now() - started }));
    }
  }

  return { analysis: fallbackAnalysis(lead), model: "contextual-fallback", error: lastError || "provider_unavailable" };
}

function buildResponse(leadId: string, requestId: string, lead: any, analysis: any, requestData: any, model: string, usedFallback: boolean) {
  const days = analysis.plano_prospeccao_7dias;
  return {
    lead_id: leadId,
    generated_at: new Date().toISOString(),
    prompt_version: "v3_structured_resilient",
    model,
    input_context: {
      empresa: lead.nome,
      nicho: lead.nicho,
      cidade: lead.cidade,
      estado: lead.endereco || null,
      site: lead.website || null,
      oferta_usuario: text(requestData?.oferta_usuario || requestData?.context?.oferta_usuario, ""),
      publico_alvo: text(requestData?.publico_alvo || requestData?.context?.publico_alvo, ""),
      dor_principal: text(requestData?.dor_principal || requestData?.context?.dor_principal, ""),
      objetivo: text(requestData?.objetivo || requestData?.context?.objetivo, ""),
      canal: text(requestData?.canal || requestData?.context?.canal, "") || null,
      etapa: text(requestData?.etapa || requestData?.context?.etapa, "") || null,
    },
    diagnostico: {
      fit: analysis.fit_level,
      dor_provavel: analysis.probable_pain,
      urgencia: analysis.fit_level === "alto" ? "alta" : "media",
      oportunidade: analysis.commercial_opportunity,
      justificativa: analysis.why_good_lead,
    },
    copies: {
      dia_1: days[0]?.mensagem || "",
      dia_2: days[1]?.mensagem || "",
      dia_3: days[2]?.mensagem || "",
      dia_4: days[3]?.mensagem || "",
      dia_5: days[4]?.mensagem || "",
      dia_6: days[5]?.mensagem || "",
      dia_7: days[6]?.mensagem || "",
    },
    abordagens_por_canal: {
      whatsapp: analysis.messages?.whatsapp_primary || "",
      instagram: analysis.messages?.instagram || "",
      email: analysis.messages?.email_body || "",
    },
    plano_prospeccao_7dias: days,
    debug: {
      request_id: requestId,
      fallback_used: usedFallback,
      cache_used: false,
      response_size_bytes: JSON.stringify(analysis).length,
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

    const rawLead = { ...rows[0], canaisProspeccao: requestData.canaisProspeccao || rows[0]?.canaisProspeccao || [] };
    const lead = normalizeLead(rawLead, requestData.search_context || requestData.context || {});

    if (lead.foco === "zuno_internal_prospecting" && !isAdmin) {
      return json({ success: false, request_id: requestId, error_code: "REFINE_PERMISSION_DENIED", error_message: "Este tipo de análise não está disponível para sua conta." }, 403);
    }

    const provider = GEMINI_KEY
      ? await callGemini(GEMINI_KEY, lead, requestData, requestId)
      : { analysis: fallbackAnalysis(lead), model: "contextual-fallback", error: "gemini_key_missing" };

    const usedFallback = provider.model === "contextual-fallback";
    const analysis = normalizeAIResult(provider.analysis, lead);
    const responsePayload = buildResponse(leadId, requestId, lead, analysis, requestData, provider.model, usedFallback);
    const now = new Date().toISOString();

    const { data: saved, error: saveError } = await admin
      .from("leads")
      .update({
        diagnostico_bullets: analysis.diagnostico_bullets,
        probabilidade_conversao: analysis.probabilidade_conversao,
        plano_prospeccao: responsePayload,
        ai_analise_gerada_em: now,
        ai_used_fallback: usedFallback,
        ai_fallback_reason: usedFallback ? provider.error || "provider_unavailable" : null,
      })
      .eq("id", leadId)
      .eq("user_id", user.id)
      .select("id, ai_analise_gerada_em");

    if (saveError || !saved?.length) {
      await logEvent(admin, user.id, "ai_analysis_failed_handled", { request_id: requestId, stage: "persist_result", internal_code: "REFINE_SAVE_FAILED", deducted_credit: false });
      return json({ success: false, request_id: requestId, error_code: "REFINE_SAVE_FAILED", error_message: "A análise foi gerada, mas não pôde ser salva. Seu crédito não foi consumido." }, 503);
    }

    let creditWarning: string | null = null;
    if (!isAdmin && !usedFallback) {
      try {
        const { data: ok, error } = await admin.rpc("increment_ai_usage", { p_user_id: user.id });
        if (error || ok !== true) creditWarning = "Análise concluída, mas houve um erro ao registrar o consumo do crédito.";
      } catch (_) {
        creditWarning = "Análise concluída, mas houve um erro ao registrar o consumo do crédito.";
      }
    }

    await logEvent(admin, user.id, "ai_analysis_completed", {
      request_id: requestId,
      leadId,
      model: provider.model,
      fallback_used: usedFallback,
      credit_consumed: !isAdmin && !usedFallback,
      duration_ms: Date.now() - started,
    });

    return json({
      ...responsePayload,
      success: true,
      request_id: requestId,
      used_fallback: usedFallback,
      fallback_reason: usedFallback ? provider.error : null,
      timing: { total_ms: Date.now() - started },
      ...(creditWarning ? { credit_warning: creditWarning } : {}),
    });
  } catch (err) {
    console.error(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "global", error: err instanceof Error ? err.message : String(err) }));
    return json({ success: false, request_id: requestId, error_code: "REFINE_UNKNOWN_ERROR", error_message: "Não foi possível refinar o conteúdo neste momento. Tente novamente." }, 500);
  }
});
