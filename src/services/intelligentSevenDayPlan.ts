import type { LeadProspeccao, PlanoProspeccaoDia, TipoDiaPlano } from "@/types/lead";
import { sanitizeBrazilianPhoneNumber } from "./sdrProspectingService";

// Este módulo NÃO gera textos comerciais. As mensagens do plano vêm do Gemini (função analisar-lead-ia),
// ficam salvas em leads.plano_prospeccao e são lidas daqui exatamente como foram salvas.
// Aqui ficam apenas: estágio do histórico, bloqueio por opt-out, alinhamento cadastral e leitura do plano salvo.

export type LeadHistoryStage =
  | "nao_contatado"
  | "contato_iniciado_sem_resposta"
  | "empresa_respondeu"
  | "empresa_interessada"
  | "reuniao_marcada"
  | "recusa_ou_optout"
  | "descartado_sem_optout";

export type CompatibilityLevel = "alta" | "media" | "basica" | "nao_determinada";

export interface ExplorableCompatibilityCriterion {
  label: string;
  status: "atendido" | "parcial" | "nao_atendido" | "nao_verificado";
  detail: string;
}

export interface ExplorableCompatibility {
  level: CompatibilityLevel;
  label: string;
  description: string;
  criteria: ExplorableCompatibilityCriterion[];
  score: number | null; // sempre nulo: nenhuma probabilidade inventada
}

/** Valida se o lead possui opt-out explícito registrado no status ou nas anotações. */
export function hasExplicitOptOut(lead: Partial<LeadProspeccao>): boolean {
  if (!lead) return false;

  const rawStatus = String(lead.status || "").toLowerCase().trim();
  if (
    rawStatus === "recusou_optout" ||
    rawStatus === "opt_out" ||
    rawStatus === "optout" ||
    rawStatus === "recusa" ||
    rawStatus === "bloqueado_optout"
  ) {
    return true;
  }

  const rawNotes = String(lead.notas || "").toLowerCase();
  const optOutPhrases = [
    "não tenho interesse",
    "nao tenho interesse",
    "não mandar mensagem",
    "nao mandar mensagem",
    "remover da lista",
    "pare de mandar",
    "opt-out",
    "optout",
    "solicitou descadastro",
    "pediu para nao contatar",
    "pediu para não contatar",
    "número errado",
    "numero errado",
  ];

  return optOutPhrases.some((phrase) => rawNotes.includes(phrase));
}

/** Detecta o estágio real de histórico do lead a partir do status e das anotações. */
export function resolveLeadHistoryStage(lead: Partial<LeadProspeccao>): LeadHistoryStage {
  if (hasExplicitOptOut(lead)) return "recusa_ou_optout";

  const rawStatus = String(lead.status || "novo").toLowerCase().trim();
  const rawNotes = String(lead.notas || "").toLowerCase();

  if (rawStatus === "reuniao_marcada" || rawStatus === "negociacao" || rawNotes.includes("status: reuniao_marcada")) {
    return "reuniao_marcada";
  }
  if (rawStatus === "interessado" || rawStatus === "qualificacao" || rawNotes.includes("status: interessado")) {
    return "empresa_interessada";
  }
  if (rawStatus === "respondeu" || rawNotes.includes("status: respondeu")) {
    return "empresa_respondeu";
  }
  if (
    rawStatus === "contato_realizado" ||
    rawStatus === "em_contato" ||
    rawStatus === "abertura_iniciada" ||
    rawStatus === "sem_resposta" ||
    rawNotes.includes("status: contato_realizado") ||
    rawNotes.includes("status: abertura_iniciada") ||
    rawNotes.includes("status: sem_resposta")
  ) {
    return "contato_iniciado_sem_resposta";
  }
  if (rawStatus === "descartado" || rawStatus === "perdido" || rawNotes.includes("status: descartado")) {
    return "descartado_sem_optout";
  }
  return "nao_contatado";
}

export function getHistoryStageLabel(stage: LeadHistoryStage): string {
  switch (stage) {
    case "nao_contatado":
      return "Não contatado";
    case "contato_iniciado_sem_resposta":
      return "Contato iniciado (aguardando retorno)";
    case "empresa_respondeu":
      return "Empresa respondeu";
    case "empresa_interessada":
      return "Empresa interessada";
    case "reuniao_marcada":
      return "Reunião marcada";
    case "recusa_ou_optout":
      return "Recusa / opt-out (contato bloqueado)";
    case "descartado_sem_optout":
      return "Descartado (fora de perfil)";
    default:
      return "Em andamento";
  }
}

/** Estágios em que a sequência fria do plano já não se aplica (a empresa respondeu ou avançou). */
export function isColdSequenceObsolete(stage: LeadHistoryStage): boolean {
  return stage === "empresa_respondeu" || stage === "empresa_interessada" || stage === "reuniao_marcada";
}

/**
 * Alinhamento cadastral: critérios observáveis no cadastro público. Não é percentual de fechamento.
 * Não usa Pixel/GTM/WhatsApp-do-site: a inspeção de HTML está suspensa (hotfix #55) e esses sinais não são verificados.
 */
export function buildAlignmentCompatibility(lead: Partial<LeadProspeccao>): ExplorableCompatibility {
  const city = lead.cidade && !String(lead.cidade).toLowerCase().includes("não inform") ? String(lead.cidade).trim() : "região de atuação";
  const niche = lead.nicho ? String(lead.nicho).trim() : "mercado local";
  const hasWebsite = Boolean(lead.website && String(lead.website).trim().length > 4);
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(reviewsCount && reviewsCount > 0);
  const phoneInfo = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);

  const criteria: ExplorableCompatibilityCriterion[] = [
    {
      label: "Telefone comercial",
      status: phoneInfo.isValid ? "atendido" : "nao_atendido",
      detail: phoneInfo.isValid
        ? `Formato brasileiro válido (${phoneInfo.formattedDisplay}); ${phoneInfo.isCellPhone ? "celular, a disponibilidade no WhatsApp se confirma na primeira abertura" : "telefone fixo, o contato inicial tende a ser por ligação"}.`
        : "Telefone ausente ou fora do padrão brasileiro.",
    },
    {
      label: "Avaliações no Google",
      status: hasReviews && reviewsCount && reviewsCount >= 5 ? "atendido" : hasReviews ? "parcial" : "nao_verificado",
      detail: hasReviews && reviewsCount
        ? `${reviewsCount} avaliações públicas registradas${rating ? ` (nota ${rating})` : ""}.`
        : "Sem histórico relevante de avaliações públicas no perfil.",
    },
    {
      label: "Endereço web cadastrado",
      status: hasWebsite ? "atendido" : "nao_atendido",
      detail: hasWebsite
        ? `URL cadastrada no perfil (${lead.website}); funcionamento não verificado.`
        : "Nenhuma página institucional ou link cadastrado no perfil (isso não prova que não exista).",
    },
    {
      label: "Mapeamento local e nicho",
      status: lead.cidade && lead.nicho ? "atendido" : "parcial",
      detail: lead.cidade && lead.nicho
        ? `Segmento (${niche}) e praça (${city}) identificados no cadastro público.`
        : "Dados incompletos de praça ou segmento.",
    },
  ];

  const hasPhone = phoneInfo.isValid;
  const hasSubstantialReviews = hasReviews && reviewsCount !== null && reviewsCount >= 5;
  let level: CompatibilityLevel = "nao_determinada";
  let label = "Compatibilidade não determinada";
  let description = "Dados públicos insuficientes para estimar a prontidão da abordagem cadastral.";

  if (!hasPhone && !hasWebsite && !hasReviews) {
    description = "Dados públicos insuficientes para estimar a prontidão da abordagem cadastral. Pesquise canais de contato antes de iniciar.";
  } else if (hasPhone && hasWebsite && hasSubstantialReviews && (reviewsCount as number) >= 10) {
    level = "alta";
    label = "Compatibilidade Alta";
    description = "Múltiplos sinais cadastrais disponíveis (telefone válido, URL informada e avaliações no Google) para contextualizar a abordagem.";
  } else if (hasPhone && (hasWebsite || hasSubstantialReviews)) {
    level = "media";
    label = "Compatibilidade Média";
    description = "Sinais cadastrais básicos identificados para fundamentar um primeiro contato objetivo e respeitoso.";
  } else if (hasPhone) {
    level = "basica";
    label = "Compatibilidade Básica";
    description = "Apenas contato telefônico localizado; outros sinais públicos ausentes no cadastro.";
  }

  return { level, label, description, criteria, score: null };
}

// ───────────────────────── Plano salvo (somente leitura) ─────────────────────────

/** Tipo efetivo do dia. Planos antigos não têm tipo_dia: dia com texto é mensagem, sem texto é "sem mensagem". */
export function resolveDayType(day: Pick<PlanoProspeccaoDia, "tipo_dia" | "mensagem">): TipoDiaPlano {
  if (day.tipo_dia) return day.tipo_dia;
  return day.mensagem && day.mensagem.trim() ? "mensagem" : "sem_mensagem";
}

export function dayHasMessage(day: PlanoProspeccaoDia | null | undefined): boolean {
  if (!day) return false;
  const type = resolveDayType(day);
  return (type === "mensagem" || type === "acompanhamento") && Boolean(day.mensagem && day.mensagem.trim());
}

/** Dias salvos no lead, ordenados e sem nenhuma regeneração. */
export function getSavedPlanDays(lead: Partial<LeadProspeccao> | null | undefined): PlanoProspeccaoDia[] {
  const days = Array.isArray(lead?.plano_prospecao_7dias) ? lead!.plano_prospecao_7dias : [];
  return [...days].filter((d) => d && Number.isFinite(Number(d.dia))).sort((a, b) => Number(a.dia) - Number(b.dia));
}

/** Primeiro dia ainda não concluído que tenha algo para o assinante fazer ou enviar. */
export function getRecommendedDay(days: PlanoProspeccaoDia[]): number | null {
  const next = days.find((d) => d.status_dia !== "concluido");
  return next ? next.dia : null;
}

export interface SdrMessageFromPlan {
  message: string;
  text: string;
  canal: PlanoProspeccaoDia["canal"];
  assuntoEmail: string;
  acaoSugerida: string;
  objetivo: string;
  isOptedOut: boolean;
  dayNumber: number;
  totalDays: number;
  isCustomEdited: boolean;
  hasMessage: boolean;
  tipoDia: TipoDiaPlano;
}

/**
 * Mensagem do SDR para o dia: o texto SALVO no plano, sem nova geração de IA e sem reescrita local.
 * Garante: texto exibido no plano === texto carregado pelo SDR.
 */
export function getSdrMessageFromPlan(lead: Partial<LeadProspeccao>, dayNumber = 1): SdrMessageFromPlan {
  const days = getSavedPlanDays(lead);
  const isOptedOut = hasExplicitOptOut(lead);
  const target = days.find((d) => d.dia === dayNumber) ?? null;

  if (!target) {
    return {
      message: "", text: "", canal: "nenhum", assuntoEmail: "", acaoSugerida: "", objetivo: "",
      isOptedOut, dayNumber, totalDays: days.length, isCustomEdited: false, hasMessage: false, tipoDia: "sem_mensagem",
    };
  }

  let assuntoEmail = target.assunto_email || "";
  let message = target.mensagem || "";

  // Planos antigos guardavam "Assunto: ..." dentro do texto: separa sem alterar o corpo.
  if (message.startsWith("Assunto:")) {
    const extracted = extractEmailSubjectAndBody(message);
    assuntoEmail = extracted.subject || assuntoEmail;
    message = extracted.body;
  }

  const hasMessage = !isOptedOut && dayHasMessage(target);
  const text = isOptedOut ? "" : message;

  return {
    message: text,
    text,
    canal: target.canal || "whatsapp",
    assuntoEmail,
    acaoSugerida: target.acao_sugerida || "",
    objetivo: target.objetivo || "",
    isOptedOut,
    dayNumber: target.dia,
    totalDays: days.length,
    isCustomEdited: Boolean(target.is_custom_edited),
    hasMessage,
    tipoDia: resolveDayType(target),
  };
}

/** Extrai assunto e corpo de e-mail de uma mensagem composta. */
export function extractEmailSubjectAndBody(rawMessage: string, defaultSubject = ""): {
  subject: string;
  body: string;
} {
  if (!rawMessage) return { subject: defaultSubject, body: "" };
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith("Assunto:")) {
    const lines = trimmed.split(/\n\n|\r\n\r\n/);
    if (lines.length >= 2) {
      return {
        subject: lines[0].replace(/^Assunto:\s*/i, "").trim(),
        body: lines.slice(1).join("\n\n").trim(),
      };
    }
    const singleBreak = trimmed.split(/\n/);
    return {
      subject: singleBreak[0].replace(/^Assunto:\s*/i, "").trim(),
      body: singleBreak.slice(1).join("\n").trim(),
    };
  }
  return { subject: defaultSubject, body: trimmed };
}
