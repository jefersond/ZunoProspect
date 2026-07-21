import type { LeadProspeccao } from "@/types/lead";

export type ProspectingChannel = "whatsapp" | "instagram" | "email";
export type ProspectingTone = "natural" | "consultivo" | "direto";
export type ProspectingGoal = "gerar_conversa" | "mostrar_exemplo" | "agendar_conversa";
export type ApproachAngle =
  | "dor_operacional"
  | "previsibilidade"
  | "velocidade"
  | "organizacao"
  | "teste_pratico"
  | "qualificacao"
  | "presenca_local";

type NicheCopyContext = {
  pain: string;
  desired_outcome: string;
  angle: ApproachAngle;
  language: string;
};

export const NICHE_COPY_CONTEXT: Record<string, NicheCopyContext> = {
  "gestor de trafego": {
    pain: "encontrar empresas com potencial para campanhas",
    desired_outcome: "gerar conversas com possiveis clientes",
    angle: "previsibilidade",
    language: "marketing",
  },
  "gestor de trafego pago": {
    pain: "encontrar empresas com potencial para campanhas",
    desired_outcome: "gerar conversas com possiveis clientes",
    angle: "previsibilidade",
    language: "marketing",
  },
  "agencia de marketing": {
    pain: "depender de indicacao ou prospeccao manual",
    desired_outcome: "criar uma rotina mais previsivel de aquisicao",
    angle: "previsibilidade",
    language: "agencia",
  },
  "social media": {
    pain: "encontrar negocios locais que precisam melhorar presenca digital",
    desired_outcome: "abrir conversas com empresas da regiao",
    angle: "velocidade",
    language: "marketing local",
  },
  consultoria: {
    pain: "identificar empresas com potencial antes de abordar",
    desired_outcome: "priorizar oportunidades melhores",
    angle: "qualificacao",
    language: "consultivo",
  },
  clinica: {
    pain: "atrair mais pacientes de forma local",
    desired_outcome: "melhorar aquisicao local",
    angle: "presenca_local",
    language: "saude",
  },
};

const FALLBACK_CONTEXT: NicheCopyContext = {
  pain: "encontrar oportunidades comerciais sem depender apenas de busca manual",
  desired_outcome: "iniciar conversas com leads mais alinhados",
  angle: "teste_pratico",
  language: "b2b",
};

const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";
const ZUNO_COMMERCIAL_FOCUS_LABEL = "oportunidade comercial";

function normalizeKey(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getNicheCopyContext(niche?: string | null): NicheCopyContext {
  const normalized = normalizeKey(niche);
  const exact = NICHE_COPY_CONTEXT[normalized];
  if (exact) return exact;

  const matchedKey = Object.keys(NICHE_COPY_CONTEXT).find((key) => normalized.includes(key) || key.includes(normalized));
  return matchedKey ? NICHE_COPY_CONTEXT[matchedKey] : FALLBACK_CONTEXT;
}

export function selectApproachAngle({
  niche,
  focus,
  lead,
}: {
  niche?: string | null;
  focus?: string | null;
  lead?: Partial<LeadProspeccao> | null;
}): ApproachAngle {
  const context = getNicheCopyContext(niche);
  const normalizedNiche = normalizeKey(niche);
  const normalizedFocus = normalizeKey(focus);

  if (normalizedFocus.includes("crm")) return "organizacao";
  if (focus === ZUNO_INTERNAL_PROSPECTING_FOCUS || normalizedFocus.includes(ZUNO_COMMERCIAL_FOCUS_LABEL)) return "qualificacao";
  if (["agencia", "consultor", "consultoria", "gestor"].some((term) => normalizedNiche.includes(term))) {
    return context.angle || "previsibilidade";
  }
  if (["social", "freela", "freelancer"].some((term) => normalizedNiche.includes(term))) return "velocidade";
  if (lead?.sinais?.has_whatsapp_on_site || lead?.instagram_url) return context.angle;

  return context.angle || "teste_pratico";
}

function getAngleSentence(angle: ApproachAngle, context: NicheCopyContext) {
  const sentences: Record<ApproachAngle, string> = {
    dor_operacional: `Muitas empresas ainda perdem tempo com ${context.pain}.`,
    previsibilidade: `A ideia e criar uma rotina mais previsivel para ${context.desired_outcome}.`,
    velocidade: `O ponto e encontrar empresas certas e iniciar conversas mais rapido.`,
    organizacao: `Tambem ajuda a organizar leads, status e proximos passos em um fluxo simples.`,
    teste_pratico: `Posso te mostrar um exemplo simples aplicado ao seu nicho?`,
    qualificacao: `O objetivo e priorizar oportunidades melhores antes de abordar.`,
    presenca_local: `Para negocios locais, contexto e timing costumam fazer diferenca na primeira conversa.`,
  };
  return sentences[angle];
}

function getLeadSignalSentence(lead?: Partial<LeadProspeccao> | null) {
  if (!lead) return "";

  if (typeof lead.total_reviews === "number" && lead.total_reviews >= 50) {
    return `A quantidade de avaliacoes sugere que voces ja tem presenca local; o ponto pode ser transformar essa reputacao em mais conversas comerciais.`;
  }

  if (typeof lead.total_reviews === "number" && lead.total_reviews > 0 && lead.total_reviews < 15) {
    return `Pelas avaliacoes disponiveis, parece haver espaco para fortalecer presenca digital e atrair mais demanda local.`;
  }

  if (lead.website) {
    return `Vi que voces ja tem site informado, entao a ideia seria conectar essa presenca online com prospeccao mais ativa.`;
  }

  if (lead.instagram_url) {
    return `Vi Instagram informado nos dados, entao parece existir uma vitrine que pode virar conversa comercial com mais clareza.`;
  }

  if (lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag || lead.sinais?.has_gtm) {
    return `Tambem apareceram sinais de mensuracao, o que pode ajudar a entender melhor quais canais geram contatos bons.`;
  }

  return "Nos dados disponiveis, nao encontrei site informado; por isso pensei em uma abordagem mais simples, pelo nome, segmento e cidade.";
}

export function generateSmartProspectingCopy({
  lead,
  niche,
  city,
  focus,
  channel = "whatsapp",
  tone = "natural",
  goal = "mostrar_exemplo",
}: {
  lead?: Partial<LeadProspeccao> | null;
  niche?: string | null;
  city?: string | null;
  focus?: string | null;
  channel?: ProspectingChannel;
  tone?: ProspectingTone;
  goal?: ProspectingGoal;
}) {
  const companyName = lead?.nome || "pessoal";
  const effectiveNiche = niche || lead?.nicho || "empresas B2B";
  const effectiveCity = city || lead?.cidade || "";
  const effectiveFocus = focus || lead?.foco || "";
  const context = getNicheCopyContext(effectiveNiche);
  const approach_angle = selectApproachAngle({ niche: effectiveNiche, focus: effectiveFocus, lead });
  const cityText = effectiveCity ? ` em ${effectiveCity}` : "";
  const angleSentence = getAngleSentence(approach_angle, context);
  const signalSentence = getLeadSignalSentence(lead);
  const isZunoInternal = effectiveFocus === ZUNO_INTERNAL_PROSPECTING_FOCUS;
  const isTrafficFocus = normalizeKey(effectiveFocus).includes("trafego") || normalizeKey(effectiveFocus).includes("traf");
  const cta =
    goal === "agendar_conversa"
      ? "Faz sentido conversarmos por 10 minutos?"
      : goal === "gerar_conversa"
        ? "Isso faz sentido para a realidade de voces hoje?"
        : "Faz sentido eu te mostrar um exemplo pratico?";

  if (isZunoInternal) {
    return {
      approach_angle,
      context,
      message: `${companyName}, tudo bem?\n\nVi que voces atuam com ${effectiveNiche}${cityText}. ${signalSentence}\n\nHoje voces ja tem um processo mais previsivel para gerar novas conversas comerciais ou isso ainda depende muito de indicacao e tentativa manual?\n\nPosso te mandar uma observacao objetiva sobre isso?`,
    };
  }

  if (isTrafficFocus) {
    const trackingSignals = [
      lead?.sinais?.has_meta_pixel ? "Meta Pixel" : null,
      lead?.sinais?.has_gtag ? "Google Analytics" : null,
      lead?.sinais?.has_gtm ? "Google Tag Manager" : null,
    ].filter(Boolean).join(", ");
    const trackingLine = trackingSignals
      ? `Vi sinais de mensuracao no site (${trackingSignals}), entao parece que voces ja tem alguma estrutura para acompanhar campanhas.`
      : "Nos dados que analisei, nao ficou claro se a mensuracao de campanhas ja esta preparada.";

    return {
      approach_angle,
      context,
      message: `${companyName}, tudo bem?\n\nAnalisei alguns sinais digitais de voces${cityText} pensando em trafego pago.\n\n${trackingLine} ${signalSentence}\n\nHoje voces ja rodam campanhas ou ainda estao ajustando pagina, Instagram e WhatsApp para receber leads mais qualificados?\n\nPosso te mandar uma sugestao rapida do que eu olharia primeiro?`,
    };
  }

  if (channel === "instagram") {
    return {
      approach_angle,
      context,
      message: `Oi, ${companyName}. Tudo bem?\n\nVi que voces atuam com ${effectiveNiche}${cityText}. ${signalSentence}\n\n${angleSentence}\n\n${cta}`,
    };
  }

  if (channel === "email") {
    return {
      approach_angle,
      context,
      message: `Assunto: Ideia rapida para ${effectiveNiche}\n\n${companyName}, tudo bem?\n\nVi que voces atuam com ${effectiveNiche}${cityText}. ${signalSentence}\n\n${angleSentence}\n\nTenho uma abordagem simples para ajudar a ${context.desired_outcome}, sem transformar isso em um pitch longo.\n\n${cta}`,
    };
  }

  const opener = tone === "direto"
    ? `${companyName}, tudo bem?`
    : `${companyName}, tudo bem?\n\nVi que voces atuam com ${effectiveNiche}${cityText}. ${signalSentence}`;
  const middle = tone === "consultivo"
    ? `Queria entender se hoje voces ja tem um processo claro para ${context.desired_outcome}.`
    : `Imaginei que ${context.pain} seja uma parte importante da rotina.`;

  return {
    approach_angle,
    context,
    message: `${opener}\n\n${middle}\n\n${angleSentence}\n\n${cta}`,
  };
}

export function applyLocalCopyAdjustment(message: string, adjustment: "shorter" | "consultative" | "direct" | "swap_cta" | "remove_generic") {
  const cleaned = message
    .replace(/Tenho uma abordagem simples para ajudar a /g, "Posso ajudar a ")
    .replace(/sem transformar isso em um pitch longo\./g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (adjustment === "shorter") {
    return cleaned
      .split("\n")
      .filter((line) => !line.toLowerCase().includes("tenho uma abordagem"))
      .slice(0, 5)
      .join("\n")
      .trim();
  }

  if (adjustment === "consultative") {
    return `${cleaned}\n\nAntes de te mandar qualquer coisa, queria entender: isso e prioridade para voces hoje?`;
  }

  if (adjustment === "direct") {
    return cleaned.replace(/Faz sentido eu te mostrar um exemplo pratico\?/g, "Posso te mandar um exemplo agora?");
  }

  if (adjustment === "swap_cta") {
    return cleaned.replace(/Faz sentido[^?]+\?/g, "Posso te mostrar um exemplo pratico?");
  }

  return cleaned
    .replace(/Imaginei que /g, "")
    .replace(/seja uma parte importante da rotina\.?/g, "pode ser um ponto importante.");
}
