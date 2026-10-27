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
  if (hasText(rawPhone) && phone.isValid) {
    facts.push({
      key: "telefone",
      label: "Telefone cadastrado",
      value: phone.formattedDisplay,
      status: statusFromSource(sources, ["telefone", "phone", "whatsapp_number"]),
      note: phone.isCellPhone ? "Celular. Se há WhatsApp só se confirma no primeiro contato." : "Telefone fixo.",
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
  const reviews = typeof lead.total_reviews === "number" && lead.total_reviews > 0 ? lead.total_reviews : null;
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

/** Primeiro dia ainda não concluído e que tem algo a enviar. Dado do próprio plano; nada é inventado. */
export function getRecommendedPlanDay(plano: readonly PlanoProspeccaoDia[] | null | undefined): PlanoProspeccaoDia | null {
  const days = [...(plano ?? [])].sort((a, b) => a.dia - b.dia);
  return days.find((d) => d.status_dia !== "concluido" && hasText(d.mensagem)) ?? null;
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
