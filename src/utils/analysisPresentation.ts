import { sanitizeBrazilianPhoneNumber } from "@/services/sdrProspectingService";
import { buildIntelligentPlan } from "@/services/intelligentSevenDayPlan";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

// Somente apresentação: reorganiza dados que a análise e o cadastro JÁ têm.
// Nada aqui chama IA, grava dados ou cria informação nova.

// ───────────────────────── Status dos dados da empresa ─────────────────────────

/**
 * - confirmado: a origem do campo está registrada como fonte externa (Google Places ou CNPJ).
 * - informado: existe no cadastro do lead, sem origem registrada.
 * - nao_verificado: existe, mas o Zuno não testou (ex.: se o site abre) ou o valor é estimado.
 * - indisponivel: não há dado no cadastro. NÃO significa que a empresa não possua o item.
 */
export type FactStatus = "confirmado" | "informado" | "nao_verificado" | "indisponivel";

export const FACT_STATUS_LABEL: Record<FactStatus, string> = {
  confirmado: "Confirmado na fonte",
  informado: "Informado no cadastro",
  nao_verificado: "Não verificado",
  indisponivel: "Indisponível",
};

export interface CompanyFact {
  key: "telefone" | "website" | "local" | "avaliacoes";
  label: string;
  /** Texto do valor. Vazio quando indisponível. */
  value: string;
  status: FactStatus;
  /** Linha de esclarecimento sob o valor. */
  note?: string;
  /** Segundo selo, quando o dado existe mas parte dele não foi verificada. */
  secondaryStatus?: FactStatus;
  secondaryNote?: string;
}

type Sources = Record<string, string> | undefined;

const EXTERNAL_SOURCES = new Set(["google_places", "cnpj_api"]);

function statusFromSource(sources: Sources, keys: string[]): FactStatus {
  const source = keys.map((k) => sources?.[k]).find(Boolean);
  if (!source) return "informado";
  if (EXTERNAL_SOURCES.has(source)) return "confirmado";
  if (source === "estimado") return "nao_verificado";
  return "informado"; // scraped, manual…
}

const hasText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function buildCompanyFacts(lead: Partial<LeadProspeccao>): CompanyFact[] {
  const sources = lead.data_sources as Sources;
  const facts: CompanyFact[] = [];

  // Telefone
  const rawPhone = lead.whatsapp_number || lead.telefone;
  const phone = sanitizeBrazilianPhoneNumber(rawPhone);
  const hasWebsite = hasText(lead.website);
  const hasWhatsappVerified = Boolean(hasWebsite && (lead.sinais?.has_whatsapp_on_site || lead.whatsapp_link));
  if (hasText(rawPhone) && phone.isValid) {
    facts.push({
      key: "telefone",
      label: "Telefone cadastrado",
      value: phone.formattedDisplay,
      status: statusFromSource(sources, ["telefone", "phone", "whatsapp_number"]),
      note: hasWhatsappVerified
        ? (phone.isCellPhone ? "Celular com WhatsApp identificado no site público." : "Telefone com WhatsApp comercial identificado no site.")
        : (phone.isCellPhone ? "Celular. Se há WhatsApp só se confirma no primeiro contato." : "Telefone fixo."),
    });
  } else if (hasText(rawPhone)) {
    facts.push({ key: "telefone", label: "Telefone cadastrado", value: String(rawPhone), status: "nao_verificado", note: "Fora do padrão brasileiro; confira antes de usar." });
  } else {
    facts.push({ key: "telefone", label: "Telefone cadastrado", value: "", status: "indisponivel", note: "Nenhum telefone no cadastro." });
  }

  // Website: a existência da URL é dado do cadastro; se ela abre ou o que há nela NÃO foi verificado.
  if (hasText(lead.website)) {
    facts.push({
      key: "website",
      label: "Website informado",
      value: lead.website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      status: statusFromSource(sources, ["website", "site"]),
      secondaryStatus: "nao_verificado",
      secondaryNote: "O Zuno não testa se o site está no ar nem o que há nele.",
    });
  } else {
    facts.push({ key: "website", label: "Website informado", value: "", status: "indisponivel", note: "Sem site no cadastro. Isso não prova que a empresa não tenha um." });
  }

  // Cidade e segmento
  const cidade = hasText(lead.cidade) ? lead.cidade.trim() : "";
  const nicho = hasText(lead.nicho) ? lead.nicho.trim() : "";
  if (cidade || nicho) {
    facts.push({
      key: "local",
      label: "Cidade e segmento",
      value: [cidade, nicho].filter(Boolean).join(" · "),
      status: statusFromSource(sources, ["cidade", "nicho", "endereco"]),
      note: cidade && nicho ? undefined : `Falta ${cidade ? "o segmento" : "a cidade"} no cadastro.`,
    });
  } else {
    facts.push({ key: "local", label: "Cidade e segmento", value: "", status: "indisponivel", note: "Sem cidade nem segmento no cadastro." });
  }

  // Avaliações
  const reviews = typeof lead.total_reviews === "number" && lead.total_reviews > 0
    ? lead.total_reviews
    : (typeof (lead as any).reviews === "number" && (lead as any).reviews > 0 ? (lead as any).reviews : null);
  const rating = typeof lead.rating === "number" && lead.rating > 0 ? lead.rating : null;
  if (reviews) {
    facts.push({
      key: "avaliacoes",
      label: "Avaliações",
      value: `${reviews} ${reviews === 1 ? "avaliação" : "avaliações"}${rating ? ` · nota ${String(rating).replace(".", ",")}` : ""}`,
      status: statusFromSource(sources, ["rating", "total_reviews", "reviews"]),
      note: rating ? undefined : "Nota não disponível.",
    });
  } else {
    facts.push({ key: "avaliacoes", label: "Avaliações", value: "", status: "indisponivel", note: "Sem avaliações públicas no cadastro." });
  }

  return facts;
}

// ───────────────────────── Seções da análise ─────────────────────────

export interface AnalysisSections {
  /** Frases que descrevem o que foi observado. Texto original, sem reescrita. */
  resumo: string[];
  /** Hipóteses ligadas ao serviço do assinante, sem o prefixo repetido. */
  oportunidade: string[];
  /** Recomendação presente na análise, sem o prefixo. Vazio quando a análise não traz uma. */
  proximoPasso: string[];
}

const NEXT_STEP = /^(pr[oó]xim[ao]\s+(?:a[cç][aã]o|passo)(?:\s+[úu]til)?(?:\s+recomendad[ao])?|pergunta\s+para\s+validar)\s*:\s*/i;
const OPPORTUNITY = /^(possibilidade\s+comercial(?:\s+para\s+[^:]{1,80})?|hip[oó]tese\s+comercial|[aâ]ngulo\s+comercial(?:\s+recomendado)?|oportunidade)\s*:\s*/i;
const LIMIT = /^o\s+que\s+isso\s+n[ãa]o\s+permite\s+concluir\s*:\s*/i;
const OBSERVED = /^(observado|o\s+que\s+isso\s+permite\s+concluir)\s*:\s*/i;

const upperFirst = (text: string) => (text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : text);

/**
 * Separa os tópicos já existentes em seções. O texto de cada tópico não é alterado; só sai o prefixo de rótulo (e a primeira letra passa a maiúscula)
 * (ex.: "Possibilidade comercial para Oportunidade comercial:") sai, porque a seção já diz o que é.
 * O que não for reconhecido fica no resumo, como veio.
 */
export function splitAnalysisBullets(bullets: readonly string[] | null | undefined): AnalysisSections {
  const out: AnalysisSections = { resumo: [], oportunidade: [], proximoPasso: [] };
  for (const raw of bullets ?? []) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    if (NEXT_STEP.test(text)) out.proximoPasso.push(upperFirst(text.replace(NEXT_STEP, "").trim()));
    else if (OPPORTUNITY.test(text)) out.oportunidade.push(upperFirst(text.replace(OPPORTUNITY, "").trim()));
    else if (LIMIT.test(text)) out.resumo.push(`Limite: ${text.replace(LIMIT, "").trim()}`);
    else if (OBSERVED.test(text)) out.resumo.push(upperFirst(text.replace(OBSERVED, "").trim()));
    else out.resumo.push(text);
  }
  return out;
}

/** Primeiro dia ainda não concluído e que tem algo a enviar. Dado do próprio plano; nada é inventado.
 * Quando o lead está em estágio avançado no funil (qualificação, negociação, etc.), retorna null. */
export function getRecommendedPlanDay(
  plano: readonly PlanoProspeccaoDia[] | null | undefined,
  leadStatus?: string | null,
): PlanoProspeccaoDia | null {
  if (isLeadInAdvancedStage(leadStatus)) {
    return null;
  }
  const days = [...(plano ?? [])].sort((a, b) => a.dia - b.dia);
  return days.find((d) => d.status_dia !== "concluido" && d.status_dia !== "bloqueado_optout" && hasText(d.mensagem)) ?? null;
}

// ───────────────────────── Estágios do funil e validação de canais ─────────────────────────

/**
 * Verifica se o lead já avançou além do estágio inicial de prospecção fria ('novo' e 'em_contato').
 * Status como 'qualificacao', 'negociacao', 'convertido' e 'perdido' não devem receber
 * recomendações automáticas de cadência fria.
 */
export function isLeadInAdvancedStage(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return ["qualificacao", "negociacao", "convertido", "perdido"].includes(s);
}

export interface FunnelStageGuidance {
  badgeLabel: string;
  badgeClass: string;
  title: string;
  guidance: string;
  actionText?: string;
}

export function getFunnelStageGuidance(status: string | null | undefined): FunnelStageGuidance | null {
  if (!status) return null;
  const s = status.toLowerCase().trim();
  switch (s) {
    case "qualificacao":
      return {
        badgeLabel: "Qualificação · Interesse",
        badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        title: "Lead em Qualificação (Interesse Demonstrado)",
        guidance: "A cadência de prospecção fria foi pausada porque a empresa respondeu. Prossiga o atendimento no canal onde ela interagiu, aprofundando o diagnóstico da rotina e alinhando os próximos passos.",
      };
    case "negociacao":
      return {
        badgeLabel: "Negociação Comercial",
        badgeClass: "border-orange-500/40 bg-orange-500/10 text-orange-300",
        title: "Lead em Negociação Ativa",
        guidance: "Cadência fria desativada. O lead está em fase de proposta ou negociação comercial. Concentre-se em tirar dúvidas sobre escopo, prazos e condições de fechamento.",
      };
    case "convertido":
      return {
        badgeLabel: "Convertido · Cliente Ganho",
        badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        title: "Lead Convertido com Sucesso",
        guidance: "Parabéns! Este lead já foi convertido em cliente. A prospecção foi concluída com sucesso. Encaminhe o cliente para o onboarding ou entrega do serviço.",
      };
    case "perdido":
      return {
        badgeLabel: "Oportunidade Arquivada",
        badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
        title: "Oportunidade Encerrada (Perdido)",
        guidance: "Cadência fria finalizada. O lead foi marcado como perdido no funil. O histórico do plano de 7 dias abaixo permanece disponível apenas para consulta.",
      };
    default:
      return null;
  }
}

export interface LeadChannelValidation {
  isAvailable: boolean;
  warningBadge?: string;
  warningNote?: string;
  suggestedAlternative?: string;
}

/**
 * Valida a disponibilidade real do canal no cadastro do lead para a etapa da cadência.
 * Impede falsas recomendações (ex: mandar e-mail quando não há e-mail cadastrado, ou afirmar
 * WhatsApp em telefone fixo sem evidência).
 */
export function validateLeadChannelForDay(
  lead: Partial<LeadProspeccao> | null | undefined,
  canal: string | null | undefined,
): LeadChannelValidation {
  if (!lead || !canal || canal === "nenhum") {
    return { isAvailable: true };
  }

  const normalizedChannel = canal.toLowerCase().trim();

  if (normalizedChannel === "email") {
    const email = lead.email ? lead.email.trim() : "";
    const hasEmail = Boolean(email && email.includes("@"));
    if (!hasEmail) {
      return {
        isAvailable: false,
        warningBadge: "E-mail não cadastrado",
        warningNote: "Não há endereço de e-mail registrado para esta empresa no cadastro público.",
        suggestedAlternative: "Pesquise o e-mail da recepção no site/Google ou utilize o WhatsApp comercial como canal alternativo.",
      };
    }
    return { isAvailable: true };
  }

  if (normalizedChannel === "whatsapp") {
    const rawPhone = lead.telefone ? lead.telefone.trim() : "";
    if (!rawPhone) {
      return {
        isAvailable: false,
        warningBadge: "Telefone não cadastrado",
        warningNote: "Nenhum telefone informado no cadastro para envio de WhatsApp.",
        suggestedAlternative: "Localize o telefone público no Google Maps ou no site da empresa antes de abordar.",
      };
    }
    const phoneInfo = sanitizeBrazilianPhoneNumber(rawPhone);
    const hasWebsite = hasText(lead.website);
    const hasWhatsappOnSite = Boolean(lead.sinais?.has_whatsapp_on_site || lead.whatsapp_link || lead.whatsapp_number);
    if (!phoneInfo.isCellPhone && !hasWhatsappOnSite) {
      return {
        isAvailable: false,
        warningBadge: "WhatsApp não confirmado",
        warningNote: hasWebsite
          ? "O número cadastrado aparenta ser telefone fixo e o WhatsApp não foi confirmado no site público."
          : "O número cadastrado aparenta ser telefone fixo e o WhatsApp não foi confirmado no cadastro público.",
        suggestedAlternative: "Ligue na recepção para solicitar o contato direto de WhatsApp ou teste o número antes de enviar.",
      };
    }
    return { isAvailable: true };
  }

  if (normalizedChannel === "instagram") {
    const insta = lead.instagram ? lead.instagram.trim() : "";
    if (!insta) {
      return {
        isAvailable: false,
        warningBadge: "Instagram não cadastrado",
        warningNote: "Perfil do Instagram não informado no cadastro.",
        suggestedAlternative: "Pesquise o perfil oficial da empresa no Instagram antes de abordar por mensagem direta.",
      };
    }
    return { isAvailable: true };
  }

  return { isAvailable: true };
}

// ───────────────────────── Pré-visualização do "Atualizar Cópias" ─────────────────────────

export interface LocalCopyUpdatePreview {
  total: number;
  /** Mensagens editadas por você: continuam como estão. */
  keptEdited: number;
  /** Mensagens não editadas cujo texto mudaria. */
  replaced: number;
  /** Exemplo do primeiro dia que mudaria. */
  example: { dia: number; before: string; after: string } | null;
}

/**
 * Mostra o que o botão faria, usando a mesma função e os mesmos parâmetros do botão, SEM gravar nada.
 * É local e gratuita (não chama IA nem rede).
 */
export function previewLocalCopyUpdate(lead: Partial<LeadProspeccao> | null | undefined, plano: readonly PlanoProspeccaoDia[]): LocalCopyUpdatePreview {
  const total = plano.length;
  const keptEdited = plano.filter((d) => d.is_custom_edited && hasText(d.mensagem)).length;
  if (!lead) return { total, keptEdited, replaced: 0, example: null };
  try {
    const result = buildIntelligentPlan({
      lead: lead as Partial<LeadProspeccao>,
      userServiceName: lead.foco || undefined,
      existingPlan: plano as PlanoProspeccaoDia[],
      forceUpdateOldCopies: true,
    });
    const changed = result.days.filter((next) => {
      const old = plano.find((p) => p.dia === next.dia);
      return old && !old.is_custom_edited && old.mensagem !== next.mensagem;
    });
    const first = changed[0];
    const old = first ? plano.find((p) => p.dia === first.dia) : undefined;
    return {
      total,
      keptEdited,
      replaced: changed.length,
      example: first && old ? { dia: first.dia, before: old.mensagem, after: first.mensagem } : null,
    };
  } catch {
    return { total, keptEdited, replaced: 0, example: null };
  }
}
