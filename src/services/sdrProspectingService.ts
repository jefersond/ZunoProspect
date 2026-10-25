import type { LeadProspeccao } from "@/types/lead";

// Carregamento dinâmico para evitar falhas em ambientes de teste sem variáveis do Supabase
async function getSupabaseClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export type SdrApproachStyle = "consultivo" | "direto" | "exemplo_pratico";

export type SdrProspectingStatus =
  | "preparado"
  | "abertura_iniciada"
  | "contato_realizado"
  | "respondeu"
  | "interessado"
  | "reuniao_marcada"
  | "sem_resposta"
  | "descartado";

export type ServiceArgumentCategory =
  | "criacao_sites"
  | "gestao_trafego"
  | "social_media"
  | "clinicas"
  | "automacao_crm"
  | "geral_b2b";

export interface ServiceArgumentProfile {
  category: ServiceArgumentCategory;
  categoryLabel: string;
  coreAngle: string;
  consultativeValueLine: string;
  directObjectiveLine: string;
  practicalExampleLine: string;
  lowFrictionQuestion: string;
}

export interface SdrProspectingConfig {
  lead: Partial<LeadProspeccao>;
  userServiceName?: string;
  targetAudience?: string;
  commercialObjective?: string;
  style?: SdrApproachStyle;
  customNotes?: string;
}

export interface GeneratedSdrMessage {
  text: string;
  style: SdrApproachStyle;
  serviceCategory: ServiceArgumentCategory;
  targetPhone: string | null;
  whatsappUrl: string | null;
  isValidMobile: boolean;
  usedSignals: {
    hasWebsite: boolean;
    hasReviews: boolean;
    rating: number | null;
    reviewsCount: number | null;
    hasPixel: boolean;
    hasWhatsappOnSite: boolean;
    isIncompleteData: boolean;
    city: string;
    niche: string;
  };
}

export interface SdrDuplicateCheckResult {
  isDuplicate: boolean;
  previousStatus?: string;
  previousDate?: string;
  reason?: string;
}

export interface MessageNaturalnessAudit {
  isNatural: boolean;
  violations: string[];
  wordCount: number;
}

const BANNED_ROBOTIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /identificamos oportunidades de melhoria/i, label: "Clichê robótico: 'identificamos oportunidades de melhoria'" },
  { pattern: /potencialize suas vendas/i, label: "Clichê robótico: 'potencialize suas vendas'" },
  { pattern: /alavanque seus resultados|alavancar suas vendas/i, label: "Clichê robótico: 'alavanque seus resultados'" },
  { pattern: /exponencialmente/i, label: "Hipérbole vazia: 'exponencialmente'" },
  { pattern: /est[áa] perdendo clientes/i, label: "Acusação não verificada: 'está perdendo clientes'" },
  { pattern: /passando s[óo] para saber se conseguiu dar uma olhada/i, label: "Follow-up passivo-agressivo: 'passando só para saber se viu'" },
  { pattern: /acompanho o perfil de voc[êe]s/i, label: "Intimidade falsa não verificada: 'acompanho o perfil de vocês'" },
  { pattern: /\+40% de contatos/i, label: "Prova social inventada: '+40% de contatos'" },
  { pattern: /diagn[óo]stico de 2 minutos/i, label: "Promessa antiga substituída: 'diagnóstico de 2 minutos'" },
];

/**
 * Audita se uma mensagem comercial respeita as regras de naturalidade e ausência de clichês robóticos.
 */
export function auditMessageNaturalness(text: string): MessageNaturalnessAudit {
  const clean = (text || "").trim();
  const violations: string[] = [];

  for (const item of BANNED_ROBOTIC_PATTERNS) {
    if (item.pattern.test(clean)) {
      violations.push(item.label);
    }
  }

  const words = clean.split(/\s+/).filter(Boolean);
  return {
    isNatural: violations.length === 0 && words.length >= 15,
    violations,
    wordCount: words.length,
  };
}

/**
 * Resolve o perfil de argumento comercial específico para o serviço do assinante e nicho do lead.
 * Garante que a mensagem mude de verdade (não apenas trocando uma palavra) conforme o serviço.
 */
export function resolveServiceArgumentProfile(
  userServiceName = "gestão de tráfego e presença digital",
  niche = "empresas locais",
  city = "sua região",
  hasWebsite = false
): ServiceArgumentProfile {
  const s = userServiceName.toLowerCase();
  const n = niche.toLowerCase();
  const cityLabel = city && city.toLowerCase() !== "não informada" ? city : "sua cidade";

  const isClinicNiche =
    n.includes("clínica") ||
    n.includes("clinica") ||
    n.includes("odonto") ||
    n.includes("dentista") ||
    n.includes("estética") ||
    n.includes("estetica") ||
    n.includes("médic") ||
    n.includes("medic") ||
    n.includes("saúde") ||
    n.includes("saude") ||
    s.includes("clínica") ||
    s.includes("clinica") ||
    s.includes("odonto");

  if (s.includes("site") || s.includes("landing") || s.includes("web") || s.includes("página")) {
    return {
      category: "criacao_sites",
      categoryLabel: "Criação de Sites e Páginas de Conversão",
      coreAngle: hasWebsite
        ? "clareza de apresentação dos serviços e conversão de visitantes em conversas no WhatsApp"
        : "estruturação de página própria para fortalecer autoridade nas buscas do Google e facilitar o contato",
      consultativeValueLine: hasWebsite
        ? `Atuo com ${userServiceName} e ajudo negócios de ${niche} a organizarem a apresentação dos serviços no site para facilitar que o visitante chame direto no WhatsApp com a dúvida certa.`
        : `Atuo com ${userServiceName} para ${niche} e ajudo empresas de ${cityLabel} a terem uma página própria enxuta e rápida, pensada para quem pesquisa no Google encontrar seus serviços e chamar no WhatsApp.`,
      directObjectiveLine: hasWebsite
        ? `Trabalho com páginas de conversão e estrutura web para ${niche} e gostaria de saber quem cuida do site e dos canais digitais aí na empresa.`
        : `Trabalho com criação de sites profissionais e páginas de captação para ${niche} em ${cityLabel} e gostaria de falar rapidamente com o responsável pelo comercial.`,
      practicalExampleLine: hasWebsite
        ? `Preparei um exemplo prático de aproximadamente 1 minuto mostrando como pequenos ajustes na estrutura da página ajudam empresas de ${niche} a converterem mais visitas em pedidos de orçamento no WhatsApp.`
        : `Montei um exemplo prático de aproximadamente 1 minuto mostrando como uma página institucional focada em conversão funciona para ${niche} em ${cityLabel}.`,
      lowFrictionQuestion: "Faz sentido eu te enviar esse exemplo rápido por aqui?",
    };
  }

  if (s.includes("social") || s.includes("instagram") || s.includes("conteúdo") || s.includes("conteudo") || s.includes("reels")) {
    return {
      category: "social_media",
      categoryLabel: "Social Media e Posicionamento Digital",
      coreAngle: "posicionamento de marca local, constância visual e geração de confiança antes do primeiro contato",
      consultativeValueLine: `Trabalho com ${userServiceName} para ${niche} e ajudo empresas de ${cityLabel} a organizarem o posicionamento e os conteúdos principais para transmitir confiança imediata a quem visita o perfil antes de pedir orçamento.`,
      directObjectiveLine: `Atuo com gestão de conteúdo e posicionamento digital para ${niche} em ${cityLabel}. Quem é a pessoa responsável pela comunicação e redes sociais de vocês?`,
      practicalExampleLine: `Organizei uma demonstração prática de aproximadamente 1 minuto mostrando como estruturar os destaques e temas semanais de ${niche} para transformar visitas ao perfil em conversas no WhatsApp.`,
      lowFrictionQuestion: "Posso compartilhar essa ideia curta com vocês por aqui?",
    };
  }

  if (s.includes("automa") || s.includes("crm") || s.includes("atendimento") || s.includes("comercial")) {
    return {
      category: "automacao_crm",
      categoryLabel: "Automação Comercial e CRM",
      coreAngle: "velocidade de resposta no WhatsApp, triagem organizada e aproveitamento dos contatos que já chegam",
      consultativeValueLine: `Atuo com ${userServiceName} e ajudo operações de ${niche} em ${cityLabel} a organizarem a triagem e o acompanhamento no WhatsApp para que nenhum orçamento fique sem resposta no meio da correria.`,
      directObjectiveLine: `Trabalho com estruturação de atendimento e CRM para ${niche}. Quem cuida hoje da rotina de recepção e acompanhamento comercial no WhatsApp de vocês?`,
      practicalExampleLine: `Montei uma demonstração prática de aproximadamente 1 minuto mostrando como organizar o fluxo de resposta e acompanhamento no WhatsApp para empresas de ${niche}.`,
      lowFrictionQuestion: "Vale eu mandar esse resumo de 1 minuto por aqui para avaliarem?",
    };
  }

  if (isClinicNiche && (s.includes("tráfego") || s.includes("trafego") || s.includes("anúncio") || s.includes("anuncio") || s.includes("clínica") || s.includes("clinica") || s.includes("paciente") || s.includes("marketing"))) {
    return {
      category: "clinicas",
      categoryLabel: "Captação de Pacientes e Marketing para Clínicas",
      coreAngle: "preenchimento de agenda, captação local de pacientes particulares e encaminhamento direto para a recepção",
      consultativeValueLine: `Trabalho com ${userServiceName} focado na área de ${niche} e ajudo clínicas de ${cityLabel} a atraírem pacientes que já estão pesquisando por atendimento e avaliação na região, direcionando o contato pronto para a recepção no WhatsApp.`,
      directObjectiveLine: `Atuo com captação de pacientes e campanhas locais para ${niche} em ${cityLabel}. Quem é a pessoa responsável pela gestão da clínica ou pelo preenchimento da agenda?`,
      practicalExampleLine: `Preparei um exemplo prático de aproximadamente 1 minuto mostrando como clínicas de ${niche} em ${cityLabel} estruturam campanhas locais para gerar pedidos de avaliação diretamente no WhatsApp da recepção.`,
      lowFrictionQuestion: "Faz sentido eu compartilhar essa demonstração curta de 1 minuto por aqui?",
    };
  }

  if (s.includes("tráfego") || s.includes("trafego") || s.includes("ads") || s.includes("anúncio") || s.includes("anuncio") || s.includes("performance")) {
    return {
      category: "gestao_trafego",
      categoryLabel: "Gestão de Tráfego e Aquisição Local",
      coreAngle: "captação de demanda ativa na região, segmentação geográfica e previsibilidade de novos pedidos de orçamento",
      consultativeValueLine: `Atuo com ${userServiceName} e ajudo empresas de ${niche} em ${cityLabel} a aparecerem para clientes da própria região no momento em que procuram pelo serviço, gerando conversas qualificadas no WhatsApp.`,
      directObjectiveLine: `Trabalho com ${userServiceName} para o segmento de ${niche} em ${cityLabel}. Quem é o responsável pelo comercial ou pela aquisição de novos clientes aí na empresa?`,
      practicalExampleLine: `Preparei um exemplo prático de aproximadamente 1 minuto mostrando como estruturar campanhas locais em ${cityLabel} para trazer pedidos de orçamento constantes no segmento de ${niche}.`,
      lowFrictionQuestion: "Posso te enviar esse vídeo curto de 1 minuto por aqui?",
    };
  }

  return {
    category: "geral_b2b",
    categoryLabel: "Consultoria e Expansão Comercial B2B",
    coreAngle: "rotina previsível de aquisição de clientes e fortalecimento dos canais comerciais na cidade",
    consultativeValueLine: `Trabalho com ${userServiceName} e apoiamos empresas de ${niche} em ${cityLabel} a organizarem uma rotina previsível de atração de novos clientes na própria cidade.`,
    directObjectiveLine: `Atuo com ${userServiceName} para empresas de ${niche} em ${cityLabel}. Quem é a pessoa responsável pelo comercial ou marketing aí na empresa?`,
    practicalExampleLine: `Estruturei uma demonstração prática de aproximadamente 1 minuto mostrando como empresas de ${niche} em ${cityLabel} organizam a captação semanal de novas oportunidades.`,
    lowFrictionQuestion: "Faz sentido eu compartilhar esse resumo de 1 minuto por aqui?",
  };
}

/**
 * Sanitiza números de telefone do Brasil para o padrão E.164 sem o sinal de +
 * Retorna apenas dígitos. Ex: 5527999998888 ou 27999998888 -> 5527999998888
 */
export function sanitizeBrazilianPhoneNumber(rawPhone?: string | null): {
  cleanNumber: string;
  formattedDisplay: string;
  isCellPhone: boolean;
  isValid: boolean;
} {
  if (!rawPhone) {
    return { cleanNumber: "", formattedDisplay: "", isCellPhone: false, isValid: false };
  }

  let digits = rawPhone.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length > 2) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  const isCellPhone = digits.length === 11 && digits[2] === "9";
  const isValid = digits.length === 10 || digits.length === 11;

  let formattedDisplay = rawPhone;
  if (digits.length === 11) {
    formattedDisplay = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    formattedDisplay = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  const cleanNumber = isValid ? `55${digits}` : "";

  return { cleanNumber, formattedDisplay, isCellPhone, isValid };
}

/**
 * Verifica se um lead já possui histórico de abordagem SDR prévia,
 * impedindo abordagens duplicadas não autorizadas.
 */
export function checkSdrDuplicateApproach(lead: Partial<LeadProspeccao>): SdrDuplicateCheckResult {
  const status = String(lead.status || "").toLowerCase();
  const notes = String(lead.notas || "");

  const alreadyApproachedStatuses = [
    "abertura_iniciada",
    "em_contato",
    "contato_realizado",
    "respondeu",
    "qualificacao",
    "negociacao",
    "ganho",
  ];

  if (alreadyApproachedStatuses.includes(status)) {
    return {
      isDuplicate: true,
      previousStatus: status,
      reason: `Este lead já possui abordagem registrada com status '${status}'.`,
    };
  }

  if (notes.includes("[SDR WhatsApp")) {
    const match = notes.match(/\[SDR WhatsApp - (\d{4}-\d{2}-\d{2})\] Status: ([a-z_]+)/i);
    return {
      isDuplicate: true,
      previousStatus: match ? match[2] : "registrado_anteriormente",
      previousDate: match ? match[1] : undefined,
      reason: "Abordagem prévia encontrada no histórico deste lead.",
    };
  }

  return { isDuplicate: false };
}

/**
 * Gera a mensagem contextual de primeira abordagem do SDR (Zuno Propect).
 * NUNCA inventa problemas não observáveis, dados falsos ou promessas exageradas.
 * Adapta o argumento real ao serviço oferecido pelo assinante e aos sinais verificados da empresa.
 */
export function generateSdrFirstApproachMessage({
  lead,
  userServiceName = "gestão de tráfego e presença digital",
  style = "consultivo",
}: SdrProspectingConfig): GeneratedSdrMessage {
  const companyName = lead.nome ? lead.nome.trim() : "Olá";
  const city = lead.cidade && lead.cidade.trim().toLowerCase() !== "não informada" ? lead.cidade.trim() : "";
  const niche = lead.nicho && lead.nicho.trim().toLowerCase() !== "não informado" ? lead.nicho.trim().toLowerCase() : "empresas da região";
  const service = userServiceName.trim() || "gestão de tráfego e presença digital";

  // Identificação dos sinais reais observáveis
  const hasWebsite = Boolean(lead.website && lead.website.trim().length > 4 && !lead.website.includes("facebook.com"));
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(reviewsCount && reviewsCount > 0);
  const hasPixel = Boolean(lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag || lead.sinais?.has_gtm);
  const hasWhatsappOnSite = Boolean(lead.sinais?.has_whatsapp_on_site);

  const rawPhone = lead.whatsapp_number || lead.telefone;
  const { cleanNumber, isCellPhone, isValid } = sanitizeBrazilianPhoneNumber(rawPhone);
  const isIncompleteData = !hasWebsite && !hasReviews && !isValid;

  const cityPhrase = city ? ` em ${city}` : "";
  const profile = resolveServiceArgumentProfile(service, niche, city || "sua região", hasWebsite);

  let body = "";

  if (style === "direto") {
    let signalLine = "";
    if (hasWebsite && hasWhatsappOnSite) {
      signalLine = `Vi o site e o canal de WhatsApp de vocês${cityPhrase}.`;
    } else if (hasWebsite) {
      signalLine = `Vi o site e os canais de atendimento de vocês${cityPhrase}.`;
    } else if (hasReviews && reviewsCount) {
      signalLine = `Vi a atuação e as avaliações de vocês no Google${cityPhrase} (${reviewsCount} avaliações).`;
    } else {
      signalLine = `Localizei o contato comercial de vocês${cityPhrase} no segmento de ${niche}.`;
    }

    body = `Oi, ${companyName}! Tudo bem?\n\n${signalLine} ${profile.directObjectiveLine}\n\nGostaria de compartilhar uma demonstração rápida de aproximadamente um minuto sobre ${profile.coreAngle}.\n\nSe preferirem não receber contato, basta me avisar.`;
  } else if (style === "exemplo_pratico") {
    let contextLine = "";
    if (hasWebsite && hasPixel) {
      contextLine = `Vi que vocês já contam com site ativo e estrutura digital${cityPhrase} no segmento de ${niche}.`;
    } else if (hasWebsite) {
      contextLine = `Vi que vocês têm site ativo${cityPhrase} no segmento de ${niche}.`;
    } else if (hasReviews && reviewsCount) {
      contextLine = `Vi a presença de vocês no Google${cityPhrase} (${reviewsCount} avaliações) no segmento de ${niche}.`;
    } else {
      contextLine = `Mapeei a atuação de vocês${cityPhrase} no segmento de ${niche}.`;
    }

    body = `Olá, pessoal da ${companyName}!\n\n${contextLine}\n\n${profile.practicalExampleLine}\n\n${profile.lowFrictionQuestion}`;
  } else {
    // Estilo Consultivo (Padrão)
    let observation = "";
    if (hasReviews && reviewsCount && reviewsCount >= 10 && rating && hasWebsite) {
      observation = `Vi que vocês têm uma ótima reputação no Google (${rating} estrelas em ${reviewsCount} avaliações) e site ativo${cityPhrase}.`;
    } else if (hasReviews && reviewsCount && reviewsCount >= 10 && rating) {
      observation = `Vi que vocês têm uma ótima reputação no Google (${rating} estrelas em ${reviewsCount} avaliações)${cityPhrase}.`;
    } else if (hasWebsite) {
      observation = `Encontrei o site e os canais de atendimento de vocês${cityPhrase} no segmento de ${niche}.`;
    } else if (isIncompleteData) {
      observation = `Localizei o registro comercial da ${companyName}${cityPhrase} durante uma pesquisa de empresas de ${niche}.`;
    } else {
      observation = `Vi a atuação de vocês no mercado de ${niche}${cityPhrase}.`;
    }

    body = `Oi, ${companyName}! Tudo bem?\n\n${observation}\n\n${profile.consultativeValueLine}\n\nSe fizer sentido para o momento de vocês, posso te mandar um vídeo de aproximadamente um minuto mostrando como funciona na prática?\n\nSe não tiverem interesse agora, sem problema nenhum.`;
  }

  const whatsappUrl = cleanNumber
    ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(body)}`
    : null;

  return {
    text: body,
    style,
    serviceCategory: profile.category,
    targetPhone: cleanNumber || null,
    whatsappUrl,
    isValidMobile: isCellPhone,
    usedSignals: {
      hasWebsite,
      hasReviews,
      rating,
      reviewsCount,
      hasPixel,
      hasWhatsappOnSite,
      isIncompleteData,
      city,
      niche,
    },
  };
}

/**
 * Gera simultaneamente as 3 variações de estilo (Consultivo, Direto e Exemplo Prático)
 * para o lead e serviço informados.
 */
export function generateAllSdrStyleVariations(
  config: Omit<SdrProspectingConfig, "style">
): Record<SdrApproachStyle, GeneratedSdrMessage> {
  return {
    consultivo: generateSdrFirstApproachMessage({ ...config, style: "consultivo" }),
    direto: generateSdrFirstApproachMessage({ ...config, style: "direto" }),
    exemplo_pratico: generateSdrFirstApproachMessage({ ...config, style: "exemplo_pratico" }),
  };
}

/**
 * Atualiza o status do lead no Supabase mantendo o isolamento de user_id do assinante.
 * Nunca marca "enviado" de forma automática; registra "abertura_iniciada" no clique
 * e status finais somente após a confirmação manual do assinante.
 */
export async function updateSdrProspectingStatus({
  leadId,
  status,
  notes,
}: {
  leadId: string;
  status: SdrProspectingStatus;
  notes?: string;
  approachMessage?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      return { success: false, error: "Usuário não autenticado ou sessão expirada." };
    }

    const userId = sessionData.session.user.id;
    const nowIso = new Date().toISOString();

    let dbStatus = "novo";
    if (status === "abertura_iniciada") dbStatus = "abertura_iniciada";
    else if (status === "contato_realizado") dbStatus = "em_contato";
    else if (status === "respondeu") dbStatus = "respondeu";
    else if (status === "interessado") dbStatus = "qualificacao";
    else if (status === "reuniao_marcada") dbStatus = "negociacao";
    else if (status === "sem_resposta" || status === "descartado") dbStatus = "perdido";

    const { data: existingLead, error: fetchErr } = await supabase
      .from("leads")
      .select("notas")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (fetchErr) {
      return { success: false, error: `Lead não encontrado ou não pertence a este usuário: ${fetchErr.message}` };
    }

    const currentNotes = existingLead?.notas || "";
    const logEntry = `\n[SDR WhatsApp - ${nowIso.slice(0, 10)}] Status: ${status}${notes ? ` - ${notes}` : ""}`;
    const newNotes = currentNotes ? `${currentNotes}${logEntry}` : logEntry.trim();

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: dbStatus,
        notas: newNotes,
        updated_at: nowIso,
      })
      .eq("id", leadId)
      .eq("user_id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao atualizar status.";
    return { success: false, error: errorMsg };
  }
}
