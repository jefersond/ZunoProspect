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
  const city = lead.cidade && !lead.cidade.includes("não inform") ? lead.cidade : "sua região";
  const cityPhrase = lead.cidade && !lead.cidade.includes("não inform") ? ` em ${lead.cidade}` : "";
  const niche = lead.nicho || "seu segmento";
  const foco = (lead.foco || "Full Service").replace(/zuno_internal_prospecting/g, "Oportunidade comercial");
  const s = foco.toLowerCase();

  const channels = availableChannels(lead);
  const channelAt = (i: number) => channels[i % channels.length] || "whatsapp";
  const score = Math.min(86, 35 + (lead.website ? 12 : 0) + (lead.instagram ? 10 : 0) + (lead.phone ? 12 : 0) + (lead.email ? 8 : 0) + (lead.rating !== null ? 6 : 0));

  const hasWeb = Boolean(lead.website && String(lead.website).trim().length > 4);
  const revCount = typeof lead.reviews === "number" ? lead.reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(revCount && revCount > 0);

  const diag = [
    `${lead.nome} atua no segmento de ${niche}${cityPhrase}.`,
    hasWeb || hasReviews
      ? `Sinais observados: ${hasWeb ? "URL informada no perfil público (requer conferência manual de funcionamento)" : "sem website cadastrado nos dados públicos"} e ${hasReviews ? `${revCount} avaliações no Google (${rating || 5} estrelas)` : "sem avaliações identificadas publicamente"}.`
      : "Poucos ativos digitais públicos mapeados; a abordagem inicial deve validar o responsável comercial antes de aprofundar.",
    s.includes("site") || s.includes("landing") || s.includes("web")
      ? hasWeb
        ? "Possibilidade comercial: avaliar se a página cadastrada facilita o contato imediato no WhatsApp de quem pesquisa pelo serviço no celular."
        : "Possibilidade comercial: avaliar oportunidade de estruturar uma página simples no Google para receber contatos comerciais diretos da cidade."
      : s.includes("social") || s.includes("instagram") || s.includes("conteúdo")
      ? "Possibilidade comercial: avaliar oportunidade de alinhar a comunicação digital para transformar interesse local em conversas comerciais diretas."
      : s.includes("crm") || s.includes("automação") || s.includes("atendimento")
      ? "Possibilidade comercial: avaliar como a empresa organiza o fluxo de mensagens no WhatsApp para evitar atrasos no atendimento a novos orçamentos."
      : `Possibilidade comercial para ${foco}: avaliar se a entrada de novos clientes hoje acontece com previsibilidade ou se oscila bastante ao longo do mês.`,
    "Próximo passo útil: enviar abertura curta e consultiva focada na rotina comercial da empresa, sem promessas agressivas nem alegações não verificadas.",
  ];

  const days = [
    {
      dia: 1,
      canal: channelAt(0),
      acao_sugerida: "Enviar abertura curta no WhatsApp focada na rotina comercial.",
      mensagem: `Oi, ${lead.nome}! Tudo bem?\n\nEncontrei o contato público de vocês pesquisando empresas de ${niche}${cityPhrase}.\n\nAtuo com ${foco} e queria te fazer uma pergunta rápida: hoje a entrada de novos clientes aí acontece de forma constante ou oscila bastante ao longo do mês?\n\nSe preferirem não receber contato, sem problemas.`,
      objecao_provavel: "Quem é você e como conseguiu nosso número?",
      resposta_sugerida: `Atuo com ${foco} para negócios de ${niche} e localizei o contato público da ${lead.nome} na pesquisa local de ${city}.`,
      cta: "Hoje a demanda de novos clientes oscila muito ao longo do mês?",
    },
    {
      dia: 2,
      canal: channelAt(1),
      acao_sugerida: "Compartilhar observação real sobre o segmento local sem intimidade falsa.",
      mensagem: `Oi, equipe da ${lead.nome}! Tudo bem?\n\nEstava analisando o mercado de ${niche}${cityPhrase}. Em ${foco}, costumo notar que muitas empresas têm boa reputação na região, mas poderiam receber mais contatos diretos de quem já pesquisa ativamente pelo serviço na internet.\n\nVocês têm interesse em avaliar como estruturar essa captação local?`,
      objecao_provavel: "Não temos interesse no momento.",
      resposta_sugerida: "Compreendo perfeitamente! Fico à disposição se em outro momento isso for prioridade.",
      cta: "Faz sentido avaliarmos isso em 5 minutos?",
    },
    {
      dia: 3,
      canal: channelAt(2),
      acao_sugerida: "Enviar e-mail ou mensagem curta com hipótese comercial clara, sem jargões.",
      mensagem: `Assunto: Pergunta rápida sobre captação de clientes - ${lead.nome}\n\nOlá, equipe da ${lead.nome}!\n\nEntrei em contato recentemente porque trabalho com ${foco} voltado para ${niche}${cityPhrase}.\n\nA ideia é bem direta: em vez de depender apenas de indicações ocasionais, estruturar uma rotina clara para que pessoas da cidade encontrem a empresa no momento em que precisam dos seus serviços.\n\nFaz sentido conversarmos 5 minutos sobre isso esta semana?`,
      objecao_provavel: "Qual é o valor do investimento?",
      resposta_sugerida: "O investimento varia conforme o objetivo de captação da empresa. Minha ideia inicial é só entender o cenário de vocês para ver se faz sentido.",
      cta: "Consegue falar 5 minutos esta semana?",
    },
    {
      dia: 4,
      canal: "whatsapp",
      acao_sugerida: "Acompanhamento leve com pergunta prática, sem cobrança passiva.",
      mensagem: `Oi, ${lead.nome}! Tudo bem?\n\nImagino que a rotina aí${cityPhrase} seja corrida. Só retomando de forma bem prática: hoje o maior desafio de vocês está em atrair novas oportunidades ou em converter os contatos que já chegam?\n\nSe não fizer sentido falar sobre isso agora, é só me avisar.`,
      objecao_provavel: "Estamos sem tempo para ver isso agora.",
      resposta_sugerida: "Sem problemas! Quando a rotina estiver mais tranquila, me avise por aqui.",
      cta: "Prefere que eu retome contato no próximo mês?",
    },
    {
      dia: 5,
      canal: "email",
      acao_sugerida: "Apresentar os 3 passos práticos da solução sem inventar estudos de caso.",
      mensagem: `Assunto: 3 pontos práticos para captação local - ${lead.nome}\n\nOlá!\n\nPara ser bem direto e prático sobre como trabalho com ${foco} para ${niche}:\n\n1. Mapeamos os termos e serviços que os clientes mais procuram em ${city}.\n2. Organizamos o canal de contato para que a pessoa fale diretamente com vocês com o mínimo de atrito.\n3. Acompanhamos semanalmente quais canais trazem contatos reais de orçamento.\n\nPosso te mostrar como isso se aplicaria no cenário da ${lead.nome}?`,
      objecao_provavel: "Já temos alguém que cuida disso internamente.",
      resposta_sugerida: "Excelente! Nesse caso, nosso foco seria apenas complementar o trabalho atual ou fornecer dados adicionais de mercado.",
      cta: "Quer que eu envie esse resumo por aqui?",
    },
    {
      dia: 6,
      canal: channelAt(5),
      acao_sugerida: "Validar respeitosamente o timing comercial da empresa.",
      mensagem: `Oi, pessoal da ${lead.nome}! Só uma pergunta sincera sobre timing: vocês estão buscando novas frentes de captação de clientes neste mês ou a prioridade do negócio agora é outra?\n\nPergunto apenas para não tomar o tempo de vocês caso o momento não seja esse.`,
      objecao_provavel: "O momento agora não é esse.",
      resposta_sugerida: "Perfeito! Obrigado pela transparência. Fico à disposição para quando surgir a necessidade.",
      cta: "Podemos manter o contato para o futuro?",
    },
    {
      dia: 7,
      canal: "whatsapp",
      acao_sugerida: "Encerrar o ciclo de forma cordial, sem pressão e mantendo portas abertas.",
      mensagem: `Olá, ${lead.nome}! Vou encerrar meus contatos por aqui para não insistir na sua rotina.\n\nSe em algum momento fizer sentido conversar sobre ${foco} para ${niche}, meu contato fica à disposição.\n\nDesejo muito sucesso aos negócios de vocês${cityPhrase}!`,
      objecao_provavel: "Obrigado pelo contato!",
      resposta_sugerida: "Disponha! Bom trabalho para vocês por aí.",
      cta: "Grande abraço e até a próxima!",
    },
  ];

  return {
    diagnostico_bullets: diag,
    probabilidade_conversao: score,
    fit_level: score >= 70 ? "alto" : score >= 45 ? "medio" : "baixo",
    commercial_opportunity: `Estruturar captação ativa e presença local para ${lead.nome} em ${niche}.`,
    probable_pain: "Oscilação no volume de novos clientes e dependência passiva de indicações.",
    why_good_lead: diag.join(" "),
    messages: {
      whatsapp_primary: days[0].mensagem,
      instagram: days[1].mensagem,
      email_body: days[2].mensagem,
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
  const foco = (lead.foco || "Full Service").replace(/zuno_internal_prospecting/g, "Oportunidade comercial");

  return `Você é um estrategista de prospecção B2B brasileiro sênior. Sua missão é gerar uma análise comercial altamente personalizada e um plano de prospecção de exatamente 7 dias progressivos e coerentes.

DADOS REAIS VERIFICADOS DO LEAD:
- ${sigs}
- Serviço/Foco oferecido pelo assinante: ${foco}
- Canais de contato permitidos: ${chans}
${oferta ? `- Oferta específica do usuário: ${oferta}` : ""}
${publico ? `- Público-alvo prioritário: ${publico}` : ""}
${dor ? `- Dor que o usuário deseja explorar: ${dor}` : ""}
${objetivo ? `- Objetivo da abordagem: ${objetivo}` : ""}

REGRAS INVIOLÁVEIS DE QUALIDADE (DIRETRIZ ANTI-ROBÔ):
1. PROIBIÇÃO TOTAL DE CLICHÊS DE IA:
   - NUNCA use as frases:
     * "identificamos oportunidades de melhoria"
     * "potencializar sua presença digital / vendas"
     * "alavancar seus resultados / vendas"
     * "transformar seu negócio"
     * "aumentar exponencialmente"
     * "está perdendo clientes"
     * "diagnóstico exclusivo"
     * "acompanho o perfil / trabalho de vocês há algum tempo" (intimidade falsa)
     * "preparei um vídeo de um minuto" / "vídeo de aproximadamente um minuto" (nunca prometa vídeo que não existe)
     * "já analisei todo o seu marketing"
     * "gap comercial importante"
     * "passando só para saber se viu minha mensagem" (follow-up passivo-agressivo proibido)
     * "+40% de conversão" (provas sociais e percentuais falsos proibidos)

2. ADAPTAÇÃO RIGOROSA AO SERVIÇO OFERECIDO:
   - Se Tráfego Pago: focar em captação local de clientes que buscam ativamente o serviço na cidade, sem acusar falhas em campanhas atuais.
   - Se Social Media: focar em comunicação, apresentação clara dos diferenciais e conversão de seguidores em orçamentos, sem fingir que auditou o Instagram da empresa.
   - Se Criação de Sites: focar em clareza de contato no celular e presença nas buscas do Google, ancorado em se o lead tem ou não site.
   - Se CRM/Automação: focar na velocidade e organização do atendimento no WhatsApp, sem acusar perda de mensagens.
   - Outros serviços: conectar com respeito à demanda comercial da empresa.

3. DIAGNÓSTICO COMERCIAL (3 ou 4 bullets curtos):
   - Bullet 1: O que sabemos sobre a empresa (fatos observados: cidade, nicho, se tem site ou avaliações).
   - Bullet 2: Sinais realmente observáveis na presença pública.
   - Bullet 3: Hipótese comercial honesta conectada ao serviço vendido pelo assinante.
   - Bullet 4: Próxima ação recomendada: iniciar abordagem consultiva focada na rotina atual de captação de clientes.

4. SEQUÊNCIA DE 7 DIAS COERENTES E PROGRESSIVOS:
   - Dia 1: Abertura humana curta e educada, perguntando sobre a rotina de captação ou confirmando o responsável comercial.
   - Dia 2: Observação real sobre o segmento local sem falsa intimidade.
   - Dia 3: Ângulo consultivo com hipótese comercial clara, sem jargões.
   - Dia 4: Acompanhamento leve com pergunta prática, sem cobrança passiva.
   - Dia 5: Ideia prática tangível do segmento em 3 passos, sem estudos de caso inventados.
   - Dia 6: Validação de timing comercial ("faz sentido avaliar agora ou o foco é outro?").
   - Dia 7: Encerramento elegante e cordial, deixando portas abertas e CRM limpo.

Retorne estritamente o JSON compatível com o schema.`;
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
    prompt_version: "v4_human_commercial_plan",
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
