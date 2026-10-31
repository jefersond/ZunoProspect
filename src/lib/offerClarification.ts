import {
  SERVICE_CATEGORY_LABELS,
  type SellerProfile,
  MIN_OFFER_DESCRIPTION_CHARS,
} from "../../supabase/functions/_shared/lead-analysis";

export interface OfferClarificationQuestion {
  question: string;
  contextService: string;
  placeholder: string;
  helperText: string;
  isDetailed: boolean;
}

/**
 * Avalia se o perfil comercial possui informação suficientemente detalhada
 * sobre o serviço e o problema que resolve, permitindo gerar a estratégia
 * sem perguntas adicionais.
 */
export function isOfferSufficientlyDetailed(profile: SellerProfile | null | undefined): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.display_name && profile.display_name.trim().length > 0);
  const hasService = Boolean(
    (profile.service_offered && profile.service_offered.trim().length > 0) ||
    (profile.service_category && profile.service_category.length > 0)
  );
  const hasOfferDescription = Boolean(
    profile.offer_description && profile.offer_description.trim().length >= MIN_OFFER_DESCRIPTION_CHARS
  );

  return hasName && hasService && hasOfferDescription;
}

/**
 * Formula de forma 100% determinística (ZERO consumo de IA ou créditos)
 * a única pergunta essencial para entender a oferta do assinante.
 */
export function getOfferClarificationQuestion(
  profile: SellerProfile | null | undefined,
  leadNicho?: string | null
): OfferClarificationQuestion {
  const isDetailed = isOfferSufficientlyDetailed(profile);

  const rawService = profile?.service_offered?.trim();
  const rawCategory = profile?.service_category
    ? SERVICE_CATEGORY_LABELS[profile.service_category as keyof typeof SERVICE_CATEGORY_LABELS]
    : "";
  const contextService = rawService || rawCategory || "seu serviço";

  const lower = contextService.toLowerCase();

  let question = `Qual problema sua oferta de ${contextService} resolve para o tipo de empresa que você quer atender?`;
  let placeholder = `Ex: Ajudamos a organizar o atendimento inicial e qualificar os contatos que chegam...`;

  if (lower.includes("automação") || lower.includes("automacao") || lower.includes("whatsapp")) {
    question = `Qual problema sua automação resolve para o tipo de empresa que você quer atender?`;
    placeholder = `Ex: Triagem automática de mensagens e confirmação de consultas no WhatsApp para evitar horários ociosos na agenda...`;
  } else if (lower.includes("tráfego") || lower.includes("trafego") || lower.includes("anúncio") || lower.includes("anuncio")) {
    question = `Qual é o foco principal da sua gestão de tráfego para os clientes que você quer atender?`;
    placeholder = `Ex: Geração de novos contatos qualificados e mensagens no WhatsApp para serviços de maior valor...`;
  } else if (lower.includes("site") || lower.includes("landing") || lower.includes("página") || lower.includes("pagina")) {
    question = `Qual é o principal objetivo dos sites ou páginas que você desenvolve para seus clientes?`;
    placeholder = `Ex: Criar uma presença profissional de alta conversão para transformar visitantes em contatos diretos...`;
  } else if (lower.includes("crm")) {
    question = `Qual gargalo comercial ou de atendimento seu projeto de CRM ajuda a resolver?`;
    placeholder = `Ex: Evitar que contatos fiquem sem resposta e organizar o acompanhamento de propostas em aberto...`;
  } else if (lower.includes("social") || lower.includes("instagram")) {
    question = `Qual transformação principal você entrega na gestão de redes sociais para empresas?`;
    placeholder = `Ex: Posicionamento visual profissional e produção de conteúdo que atrai clientes locais...`;
  }

  // Se houver nicho do lead informado (ex: clínica odontológica), contextualiza sutilmente a sugestão
  if (leadNicho && !isDetailed) {
    if (placeholder.includes("clientes...")) {
      placeholder = placeholder.replace("clientes...", `empresas como esta (${leadNicho})...`);
    } else {
      placeholder = `${placeholder.replace(/\.\.\.$/, "")} em empresas como ${leadNicho}...`;
    }
  }

  const helperText =
    "Sua resposta será usada para personalizar a abordagem da Zuno. Se preferir não detalhar agora, a Zuno gerará uma estratégia exploratória e prudente, sem inventar resultados.";

  return {
    question,
    contextService,
    placeholder,
    helperText,
    isDetailed,
  };
}

/**
 * Gera uma descrição de oferta exploratória e prudente quando o usuário
 * opta por "Continuar sem responder" (ou não sabe detalhar no momento).
 * Cumpre a exigência de >= 30 caracteres do backend sem inventar métricas ou falsas promessas.
 */
export function buildExploratoryOfferDescription(contextService: string): string {
  const clean = contextService.trim() || "serviços profissionais";
  return `Atuação comercial em ${clean}, com abordagem consultiva e exploratória focada em entender a rotina da empresa sem promessas prévias.`;
}
