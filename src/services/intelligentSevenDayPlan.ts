import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import { sanitizeBrazilianPhoneNumber } from "./sdrProspectingService";

export type LeadHistoryStage =
  | "nao_contatado"
  | "contato_iniciado_sem_resposta"
  | "empresa_respondeu"
  | "empresa_interessada"
  | "reuniao_marcada"
  | "recusa_ou_optout"
  | "descartado_sem_optout";

export type ServiceArgumentCategory =
  | "gestao_trafego"
  | "social_media"
  | "criacao_sites"
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

export interface IntelligentSevenDayPlanResult {
  leadId: string;
  companyName: string;
  userServiceName: string;
  historyStage: LeadHistoryStage;
  historyStageLabel: string;
  isOptedOutOrRefused: boolean;
  currentRecommendedDay: number | null;
  proximaAcaoGlobal: string;
  resumoContinuidade: string;
  days: PlanoProspeccaoDia[];
  diagnostico: string[];
  probabilidade: number;
}

export interface BuildIntelligentPlanOptions {
  lead: Partial<LeadProspeccao>;
  userServiceName?: string;
  existingPlan?: PlanoProspeccaoDia[] | null;
  overrideHistoryStage?: LeadHistoryStage;
}

export interface MessageNaturalnessAudit {
  isNatural: boolean;
  hasBannedPhrases: boolean;
  violations: string[];
  detected: string[];
  wordCount: number;
}

export const BANNED_ROBOTIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /identificamos oportunidades de melhoria/i, label: "Clichê robótico: 'identificamos oportunidades de melhoria'" },
  { pattern: /potencialize suas vendas|potencializar sua presen[çc]a/i, label: "Clichê robótico: 'potencializar presença/vendas'" },
  { pattern: /alavanque seus resultados|alavancar suas vendas|alavancar seus resultados/i, label: "Clichê robótico: 'alavancar resultados/vendas'" },
  { pattern: /transformar seu neg[óo]cio/i, label: "Clichê robótico: 'transformar seu negócio'" },
  { pattern: /aumentar exponencialmente/i, label: "Hipérbole vazia: 'aumentar exponencialmente'" },
  { pattern: /est[áa] perdendo clientes/i, label: "Acusação não verificada: 'está perdendo clientes'" },
  { pattern: /tenho um diagn[óo]stico exclusivo/i, label: "Falsa exclusividade: 'diagnóstico exclusivo'" },
  { pattern: /passando s[óo] para saber se|s[óo] para saber se conseguiu dar uma olhada/i, label: "Follow-up passivo-agressivo: 'passando só para saber se viu'" },
  { pattern: /acompanho o perfil de voc[êe]s|acompanho o trabalho de voc[êe]s h[áa] algum tempo/i, label: "Intimidade falsa não verificada: 'acompanho o perfil/trabalho de vocês'" },
  { pattern: /preparei um v[íi]deo de um minuto|v[íi]deo de aproximadamente um minuto|demonstra[çc][ãa]o r[áa]pida de 1 minuto|exemplo pr[áa]tico de 1 minuto/i, label: "Promessa de vídeo/material inexistente: 'vídeo/demonstração de 1 minuto'" },
  { pattern: /j[áa] analisei todo o seu marketing/i, label: "Afirmação falsa de auditoria: 'já analisei todo o seu marketing'" },
  { pattern: /\+40% de contatos|\+30% de convers[ãa]o/i, label: "Prova social inventada: percentual não auditado" },
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
    isNatural: violations.length === 0 && words.length >= 10,
    hasBannedPhrases: violations.length > 0,
    violations,
    detected: violations,
    wordCount: words.length,
  };
}

/**
 * Resolve o perfil de argumento comercial específico para o serviço do assinante e nicho do lead.
 */
export function resolveServiceArgumentProfile(
  userServiceName = "gestão de tráfego e presença digital",
  niche = "empresas locais",
  city = "sua região",
  hasWebsite = false
): ServiceArgumentProfile {
  const s = (userServiceName || "").toLowerCase();
  const cityLabel = city && city.toLowerCase() !== "não informada" ? city : "sua cidade";

  if (s.includes("site") || s.includes("landing") || s.includes("web") || s.includes("página")) {
    return {
      category: "criacao_sites",
      categoryLabel: "Criação de Sites e Páginas de Conversão",
      coreAngle: hasWebsite
        ? "clareza de informações e facilidade para o cliente entrar em contato direto pelo WhatsApp"
        : "presença no Google com página rápida para receber contatos comerciais da cidade",
      consultativeValueLine: hasWebsite
        ? `Vi os canais de atendimento de vocês em ${cityLabel} e notei oportunidades para facilitar o contato imediato de quem pesquisa no celular.`
        : `Notei que vocês atendem em ${cityLabel}, mas não localizei uma página própria no Google para direcionar quem busca pelos seus serviços.`,
      directObjectiveLine: hasWebsite
        ? `Atuo com criação de sites e páginas rápidas em ${cityLabel}. Quem cuida da presença digital aí na empresa?`
        : `Ajudo negócios de ${niche} em ${cityLabel} a terem uma página própria de contato no Google. Quem é o responsável?`,
      practicalExampleLine: `Estruturei 3 ajustes objetivos que tornam a página da empresa mais clara e rápida para converter visitas em conversas no WhatsApp.`,
      lowFrictionQuestion: hasWebsite
        ? "Posso te enviar uma observação prática sobre como tornar o contato da página mais direto?"
        : "Faz sentido avaliar uma página simples para vocês receberem contatos do Google?",
    };
  }

  if (s.includes("social") || s.includes("instagram") || s.includes("conteúdo") || s.includes("conteudo") || s.includes("feed")) {
    return {
      category: "social_media",
      categoryLabel: "Social Media e Comunicação Digital",
      coreAngle: "comunicação clara dos diferenciais do negócio e facilidade para transformar seguidores em contatos comerciais",
      consultativeValueLine: `Acompanho a movimentação de ${niche} em ${cityLabel} e ajudo empresas a comunicarem com clareza seus serviços para atrair novos clientes locais.`,
      directObjectiveLine: `Trabalho com comunicação e redes sociais para ${niche} em ${cityLabel}. Quem responde pela divulgação da empresa?`,
      practicalExampleLine: `Separei 3 ideias simples de apresentação dos serviços de vocês que costumam gerar perguntas reais no direct.`,
      lowFrictionQuestion: "Faz sentido eu te mandar essas 3 ideias de comunicação aplicadas ao seu segmento?",
    };
  }

  if (s.includes("crm") || s.includes("automação") || s.includes("automacao") || s.includes("atendimento") || s.includes("processo")) {
    return {
      category: "automacao_crm",
      categoryLabel: "Automação de Atendimento e Organização Comercial",
      coreAngle: "organização do atendimento para responder rápido sem deixar oportunidades sem retorno",
      consultativeValueLine: `Ajudo empresas de ${niche} em ${cityLabel} a organizarem o fluxo de mensagens no WhatsApp para que nenhum contato de cliente fique sem resposta ou acompanhamento.`,
      directObjectiveLine: `Atuo com organização de atendimento e processos comerciais em ${cityLabel}. Quem é a pessoa responsável por vendas ou atendimento aí?`,
      practicalExampleLine: `Desenvolvi um roteiro simples de triagem de contatos no WhatsApp que organiza quem está pronto para comprar e quem precisa de acompanhamento.`,
      lowFrictionQuestion: "Vale uma conversa rápida de 5 minutos sobre como vocês organizam o fluxo de mensagens hoje?",
    };
  }

  if (s.includes("tráfego") || s.includes("trafego") || s.includes("anúncio") || s.includes("anuncio") || s.includes("ads") || s.includes("google ads") || s.includes("meta ads")) {
    return {
      category: "gestao_trafego",
      categoryLabel: "Gestão de Tráfego Pago e Captação Local",
      coreAngle: "estratégias práticas de captação de clientes da própria cidade que já pesquisam pelo serviço",
      consultativeValueLine: `Ajudo empresas de ${niche} em ${cityLabel} a estruturarem uma captação ativa de novos clientes, direcionando pessoas da região diretamente para o WhatsApp comercial.`,
      directObjectiveLine: `Atuo com anúncios e captação local de clientes para ${niche} em ${cityLabel}. Quem responde pela parte comercial ou de marketing?`,
      practicalExampleLine: `Mapeei como clientes de ${cityLabel} pesquisam por ${niche} e estruturei uma forma direta de captar essa demanda sem desperdício de verba.`,
      lowFrictionQuestion: "Posso te mandar uma ideia objetiva sobre como estruturar essa captação local por aqui?",
    };
  }

  return {
    category: "geral_b2b",
    categoryLabel: "Serviços Comerciais B2B",
    coreAngle: "geração previsível de novas oportunidades e fortalecimento da presença comercial na região",
    consultativeValueLine: `Atuo com ${userServiceName} em ${cityLabel} apoiando empresas de ${niche} a ampliarem suas oportunidades comerciais com previsibilidade.`,
    directObjectiveLine: `Trabalho com ${userServiceName} para ${niche} em ${cityLabel}. Quem seria o contato responsável pelo comercial ou parcerias?`,
    practicalExampleLine: `Organizei uma proposta prática de como o nosso modelo de trabalho se conecta às necessidades comerciais de empresas como a ${niche}.`,
    lowFrictionQuestion: "Faz sentido conversarmos 5 minutos sobre esse formato para vocês?",
  };
}

/**
 * Verifica se o lead possui recusa ou opt-out registrado de forma explícita.
 */
export function hasExplicitOptOut(lead: Partial<LeadProspeccao>): boolean {
  if (!lead) return false;
  if ((lead as unknown as { opt_out?: boolean; optOut?: boolean }).opt_out === true) return true;
  if ((lead as unknown as { opt_out?: boolean; optOut?: boolean }).optOut === true) return true;

  const rawStatus = String(lead.status || "").toLowerCase().trim();
  const rawNotes = String(lead.notas || "").toLowerCase();

  if (rawStatus === "opt_out" || rawStatus === "recusou_optout") return true;

  const optOutPhrases = [
    "não quero contato",
    "nao quero contato",
    "pediu para não",
    "pediu para nao",
    "recusou contato",
    "recusa registrada",
    "status: recusou_optout",
    "status: opt_out",
    "solicitou descadastro",
    "remova meu contato",
    "tire meu número",
    "tire meu numero",
    "não autorizou",
    "nao autorizou",
    "bloqueio de contato",
  ];

  return optOutPhrases.some((phrase) => rawNotes.includes(phrase));
}

/**
 * Detecta o estágio real de histórico do lead a partir do status e das anotações.
 */
export function resolveLeadHistoryStage(
  lead: Partial<LeadProspeccao>,
  overrideStage?: LeadHistoryStage
): LeadHistoryStage {
  if (hasExplicitOptOut(lead)) {
    return "recusa_ou_optout";
  }

  if (overrideStage) return overrideStage;

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
      return "Não contatado (Aguardando Dia 1)";
    case "contato_iniciado_sem_resposta":
      return "Contato iniciado (Aguardando retorno)";
    case "empresa_respondeu":
      return "Empresa respondeu (Triagem consultiva)";
    case "empresa_interessada":
      return "Empresa interessada (Avançar para fechamento)";
    case "reuniao_marcada":
      return "Reunião marcada (Preparar diagnóstico)";
    case "recusa_ou_optout":
      return "Recusa / Opt-out (Contato bloqueado)";
    case "descartado_sem_optout":
      return "Descartado (Fora de perfil)";
    default:
      return "Em andamento";
  }
}


/**
 * Constrói o diagnóstico comercial estruturado em 4 pontos objetivos respondendo às 6 perguntas centrais.
 */
export function buildStructuredDiagnosis(
  lead: Partial<LeadProspeccao>,
  userServiceName = "gestão de tráfego e presença digital"
): { diagnostico: string[]; probabilidade: number } {
  const companyName = lead.nome ? String(lead.nome).trim() : "Empresa";
  const city = lead.cidade && !String(lead.cidade).toLowerCase().includes("não inform") ? String(lead.cidade).trim() : "região de atuação";
  const niche = lead.nicho ? String(lead.nicho).trim() : "mercado local";
  const hasWebsite = Boolean(lead.website && String(lead.website).trim().length > 4);
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(reviewsCount && reviewsCount > 0);
  const hasPixel = Boolean(lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag);
  const phoneInfo = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);

  const bullets: string[] = [];

  // Ponto 1: O que sabemos de fato (dados verificados)
  if (hasReviews && reviewsCount && rating) {
    bullets.push(`Empresa ativa em ${city} com ${reviewsCount} avaliações públicas (nota ${rating}) e reputação estabelecida no Google.`);
  } else if (hasWebsite) {
    bullets.push(`Empresa ativa em ${city} no segmento de ${niche}, com site institucional ativo.`);
  } else {
    bullets.push(`Empresa ativa em ${city} com dados comerciais públicos localizados na pesquisa local de ${niche}.`);
  }

  // Ponto 2: Sinais observáveis de presença digital
  if (hasWebsite && hasPixel) {
    bullets.push(`Presença digital com tags de rastreamento ativas (Meta Pixel/Google Tag) no site institucional.`);
  } else if (hasWebsite && !hasPixel) {
    bullets.push(`Possui site ativo, mas sem tags de tráfego avançado identificadas na página inicial.`);
  } else {
    bullets.push(`Sem site próprio indexado no perfil público; contato direto concentrado no canal telefônico/WhatsApp.`);
  }

  // Ponto 3: Hipótese comercial ligada ao serviço do assinante
  const serviceLower = userServiceName.toLowerCase();
  if (serviceLower.includes("trafego") || serviceLower.includes("tráfego") || serviceLower.includes("anúncio") || serviceLower.includes("anuncio")) {
    bullets.push(`Oportunidade para anúncios locais de busca e mapa em ${city}, captando pessoas que já procuram por ${niche}.`);
  } else if (serviceLower.includes("social") || serviceLower.includes("instagram") || serviceLower.includes("conteudo") || serviceLower.includes("conteúdo")) {
    bullets.push(`Oportunidade para fortalecer presença visual e ritmo de postagens demonstrando serviços e diferenciais em ${city}.`);
  } else if (serviceLower.includes("site") || serviceLower.includes("landing")) {
    if (!hasWebsite) {
      bullets.push(`Oportunidade clara para desenvolvimento de landing page ou site profissional para captar demandas de ${city}.`);
    } else {
      bullets.push(`Oportunidade para modernização de página de conversão e foco em velocidade e chamadas no WhatsApp.`);
    }
  } else if (serviceLower.includes("automacao") || serviceLower.includes("automação") || serviceLower.includes("crm")) {
    bullets.push(`Oportunidade para reduzir tempo de resposta comercial no WhatsApp e garantir acompanhamento dos contatos.`);
  } else {
    bullets.push(`Oportunidade para estruturar rotina de captação ativa com abordagem consultiva e respeito ao decisor.`);
  }

  // Ponto 4: Próxima ação recomendada
  bullets.push(`Iniciar contato pelo canal disponível com abertura curta e pergunta de baixo atrito sobre a rotina de novos clientes.`);

  let probabilidade = 50;
  if (phoneInfo.isValid) probabilidade += 15;
  if (hasReviews && reviewsCount && reviewsCount >= 10) probabilidade += 15;
  if (hasWebsite) probabilidade += 10;
  if (phoneInfo.isCellPhone) probabilidade += 5;
  if (probabilidade > 95) probabilidade = 95;

  return { diagnostico: bullets, probabilidade };
}

/**
 * Constrói ou adapta o Plano de Prospecção de 7 Dias garantindo:
 * 1. Sequência coerente de 7 etapas.
 * 2. Zero clichês robóticos.
 * 3. Adaptação a opt-out, respostas e reuniões.
 * 4. Preservação de edições manuais existentes.
 */
export function buildIntelligentPlan({
  lead,
  userServiceName = "gestão de tráfego e captação local",
  existingPlan = null,
  overrideHistoryStage,
}: BuildIntelligentPlanOptions): IntelligentSevenDayPlanResult {
  const companyName = lead.nome ? String(lead.nome).trim() : "Empresa";
  const city = lead.cidade && !String(lead.cidade).toLowerCase().includes("não inform") ? String(lead.cidade).trim() : "sua região";
  const niche = lead.nicho ? String(lead.nicho).trim() : "seu segmento";
  const service = userServiceName.trim() || "captação local e presença digital";

  const hasWebsite = Boolean(lead.website && String(lead.website).trim().length > 4);
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(reviewsCount && reviewsCount > 0);
  const phoneInfo = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);
  const hasIncompleteData = !hasWebsite && !hasReviews && !phoneInfo.isCellPhone;

  const serviceProfile = resolveServiceArgumentProfile(service, niche, city, hasWebsite);
  const historyStage = resolveLeadHistoryStage(lead, overrideHistoryStage);
  const isOptedOutOrRefused = historyStage === "recusa_ou_optout";
  const isDiscardedWithoutOptOut = historyStage === "descartado_sem_optout";

  // Mapeia dias já concluídos ou salvos
  const basePlanRaw: PlanoProspeccaoDia[] = Array.isArray(existingPlan) && existingPlan.length > 0
    ? existingPlan
    : Array.isArray(lead.plano_prospecao_7dias) && lead.plano_prospecao_7dias.length > 0
    ? lead.plano_prospecao_7dias
    : [];

  const completedSet = new Set<number>();
  basePlanRaw.forEach((d) => {
    if (d.status_dia === "concluido") completedSet.add(d.dia);
  });

  let firstUncompletedDay: number | null = null;
  for (let d = 1; d <= 7; d++) {
    if (!completedSet.has(d)) {
      firstUncompletedDay = d;
      break;
    }
  }

  // Definição estruturada dos 7 dias preservando a sequência de 7 etapas
  const blueprints: Array<{
    dia: number;
    canal: "whatsapp" | "instagram" | "email";
    titulo_dia: string;
    objetivo: string;
    acao_sugerida: string;
    explicacao_tarefa: string;
    assunto_email?: string;
    defaultMessage: string;
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
  }> = [
    {
      dia: 1,
      canal: "whatsapp",
      titulo_dia: "Dia 1 — Abertura Curta e Identificação de Demanda",
      objetivo: `Iniciar primeiro contato com a ${companyName} sobre ${service} com mensagem direta, educada e sem parecer script frio`,
      acao_sugerida: hasIncompleteData
        ? "Conferir canal disponível e enviar abertura neutra para identificar o responsável"
        : "Enviar mensagem curta no WhatsApp focada na rotina comercial da empresa",
      explicacao_tarefa: hasIncompleteData
        ? "Como os dados públicos são reduzidos, confirme educadamente se este é o canal certo antes de aprofundar."
        : "Envie uma mensagem curta com pergunta simples sobre a rotina de captação de clientes da empresa.",
      defaultMessage: hasIncompleteData
        ? `Oi, pessoal da ${companyName}! Tudo bem?\n\nAtuo com ${service} em ${city}. Vocês atendem novos clientes de ${niche} por este número ou o contato comercial fica em outro canal?`
        : `Oi, ${companyName}! Tudo bem?\n\nEncontrei o contato público de vocês pesquisando empresas de ${niche} em ${city}.\n\nTrabalho com ${service} e queria te fazer uma pergunta rápida: hoje a entrada de novos clientes aí acontece de forma constante ou oscila bastante ao longo do mês?\n\nSe preferirem não receber contato, sem problemas.`,
      objecao_provavel: "Quem é você e como conseguiu nosso número?",
      resposta_sugerida: `Atuo com ${service} para negócios de ${niche} e localizei o contato público da ${companyName} na pesquisa local de ${city}.`,
      cta: serviceProfile.lowFrictionQuestion,
    },
    {
      dia: 2,
      canal: "instagram",
      titulo_dia: "Dia 2 — Observação de Presença Digital sem Intimidade Falsa",
      objetivo: "Compartilhar observação real sobre o segmento local sem fingir que acompanha a empresa há tempos",
      acao_sugerida: "Enviar Direct ou mensagem no canal secundário comentando a demanda local",
      explicacao_tarefa: "Regra: jamais diga 'acompanho vocês há muito tempo'. Fale apenas sobre o que realmente observou no segmento local.",
      defaultMessage: `Oi, equipe da ${companyName}! Tudo bem?\n\nEstava analisando o mercado de ${niche} aqui em ${city}. Em ${service}, costumo notar que muitas empresas têm boa reputação na região, mas poderiam receber mais contatos diretos de pessoas que já procuram pelo serviço na internet.\n\nVocês têm interesse em avaliar como estruturar essa captação local?`,
      objecao_provavel: "Não temos interesse no momento.",
      resposta_sugerida: "Compreendo perfeitamente! Fico à disposição se em algum momento isso for prioridade para vocês.",
      cta: "Faz sentido avaliarmos isso em 5 minutos?",
    },
    {
      dia: 3,
      canal: "email",
      titulo_dia: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
      objetivo: "Apresentar uma hipótese comercial clara conectada ao serviço oferecido, sem jargões de marketing",
      acao_sugerida: "Enviar e-mail curto explicando a lógica de trabalho para o segmento",
      explicacao_tarefa: "Separe assunto e corpo. Não use palavras como 'alavancar', 'potencializar' ou promessas de resultado milagroso.",
      assunto_email: `Pergunta rápida sobre captação de clientes - ${companyName}`,
      defaultMessage: `Assunto: Pergunta rápida sobre captação de clientes - ${companyName}\n\nOlá, equipe da ${companyName}!\n\nEntrei em contato recentemente porque trabalho com ${service} voltado para ${niche} em ${city}.\n\nA ideia é bem direta: em vez de depender apenas de indicações ocasionais, estruturar uma rotina clara para que pessoas da cidade encontrem a empresa no momento em que precisam dos seus serviços.\n\nFaz sentido conversarmos 5 minutos sobre isso esta semana?`,
      objecao_provavel: "Qual é o valor do investimento?",
      resposta_sugerida: "O investimento varia conforme o objetivo de captação da empresa. Minha ideia inicial é só entender o cenário de vocês para ver se faz sentido.",
      cta: "Consegue falar 5 minutos esta semana?",
    },
    {
      dia: 4,
      canal: "whatsapp",
      titulo_dia: "Dia 4 — Acompanhamento Leve sem Cobrança Passiva",
      objetivo: "Retomar o contato com uma pergunta útil de diagnóstico, sem cobrar leitura de mensagens anteriores",
      acao_sugerida: "Enviar pergunta simples sobre a principal dor da rotina comercial",
      explicacao_tarefa: "Regra de ouro: jamais escreva 'passando para saber se viu minha mensagem'. Faça uma pergunta prática sobre o negócio.",
      defaultMessage: `Oi, ${companyName}! Tudo bem?\n\nImagino que a rotina aí em ${city} seja corrida. Só retomando de forma bem prática: hoje o maior desafio de vocês está em atrair novas oportunidades ou em converter os contatos que já chegam?\n\nSe não fizer sentido falar sobre isso agora, é só me avisar.`,
      objecao_provavel: "Estamos sem tempo para ver isso agora.",
      resposta_sugerida: "Sem problemas! Quando a rotina estiver mais tranquila, me avise por aqui.",
      cta: "Prefere que eu retome contato no próximo mês?",
    },
    {
      dia: 5,
      canal: "email",
      titulo_dia: "Dia 5 — Ideia Prática Tangível do Segmento sem Cases Falsos",
      objetivo: "Apresentar em 3 pontos objetivos como a solução funciona, sem inventar estudos de caso com percentuais falsos",
      acao_sugerida: "Descrever os 3 passos práticos do serviço para empresas do nicho",
      explicacao_tarefa: "Apresente 3 etapas claras de trabalho. Nunca use percentuais inventados como '+40% de conversão'.",
      assunto_email: `3 pontos práticos para captação local - ${companyName}`,
      defaultMessage: `Assunto: 3 pontos práticos para captação local - ${companyName}\n\nOlá!\n\nPara ser bem direto e prático sobre como trabalho com ${service} para ${niche}:\n\n1. Mapeamos os termos e serviços que os clientes mais procuram em ${city}.\n2. Organizamos o canal de contato para que a pessoa fale diretamente com vocês com o mínimo de atrito.\n3. Acompanhamos semanalmente quais canais trazem contatos reais de orçamento.\n\nPosso te mostrar como isso se aplicaria no cenário da ${companyName}?`,
      objecao_provavel: "Já temos alguém que cuida disso.",
      resposta_sugerida: "Excelente! Nesse caso, nosso foco seria apenas complementar o trabalho atual ou fornecer dados adicionais de mercado.",
      cta: "Quer que eu envie esse resumo por aqui?",
    },
    {
      dia: 6,
      canal: "instagram",
      titulo_dia: "Dia 6 — Validação Respeitosa de Momento e Prioridade",
      objetivo: "Confirmar se o tema é prioridade no momento ou se deve ficar para uma etapa futura",
      acao_sugerida: "Enviar pergunta curta validando o timing comercial da empresa",
      explicacao_tarefa: "Pergunte com transparência se faz sentido avaliar o tema neste mês ou se a empresa está focada em outra prioridade.",
      defaultMessage: `Oi, pessoal da ${companyName}! Só uma pergunta sincera sobre timing: vocês estão buscando novas frentes de captação de clientes neste mês ou a prioridade do negócio agora é outra?\n\nPergunto apenas para não tomar o tempo de vocês caso o momento não seja esse.`,
      objecao_provavel: "O momento agora não é esse.",
      resposta_sugerida: "Perfeito! Obrigado pela transparência. Fico à disposição para quando surgir a necessidade.",
      cta: "Podemos manter o contato para o futuro?",
    },
    {
      dia: 7,
      canal: "whatsapp",
      titulo_dia: "Dia 7 — Encerramento Elegante e Portas Abertas",
      objetivo: "Encerrar a sequência com profissionalismo e respeito, sem pressão e mantendo o canal aberto",
      acao_sugerida: "Enviar mensagem cordial de encerramento e atualizar o status no CRM",
      explicacao_tarefa: "Encerre o ciclo cordialmente. Não faça apelos emocionais nem demonstre frustração.",
      defaultMessage: `Olá, ${companyName}! Vou encerrar meus contatos por aqui para não insistir na sua rotina.\n\nSe em algum momento fizer sentido conversar sobre ${service} para ${niche}, meu contato fica à disposição.\n\nDesejo muito sucesso aos negócios de vocês em ${city}!`,
      objecao_provavel: "Obrigado pelo contato!",
      resposta_sugerida: "Disponha! Bom trabalho para vocês por aí.",
      cta: "Grande abraço e até a próxima!",
    },
  ];

  const adaptedDays: PlanoProspeccaoDia[] = blueprints.map((blueprint) => {
    const existingDay = basePlanRaw.find((item) => Number(item.dia) === blueprint.dia);
    const isCompleted = completedSet.has(blueprint.dia);
    const isCurrentActiveDay = blueprint.dia === firstUncompletedDay;

    // Caso de Opt-out / Recusa: bloqueio imediato
    if (isOptedOutOrRefused) {
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: blueprint.canal,
        objetivo: "Respeitar a decisão da empresa e impedir qualquer disparo de insistência.",
        acao_sugerida: "NÃO ENVIAR MENSAGEM — Respeitar opt-out registrado.",
        titulo: "Bloqueado por Opt-out",
        titulo_dia: "Bloqueado por Opt-out",
        status_dia: "bloqueado_optout",
        adaptation_reason: "Opt-out ou recusa registrado no lead. Todas as mensagens de follow-up foram desativadas.",
        mensagem: "",
        objecao_provavel: "Empresa pediu para não receber contatos.",
        resposta_sugerida: "Nenhuma resposta adicional necessária. Registro arquivado.",
        cta: "Não aplicável (Opt-out ativo)",
      };
    }

    // Caso de Descarte sem Opt-out
    if (isDiscardedWithoutOptOut) {
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: blueprint.canal,
        titulo_dia: `${blueprint.titulo_dia} (Arquivado — Fora de Perfil)`,
        objetivo: "Lead arquivado por falta de aderência comercial.",
        acao_sugerida: "NÃO ENVIAR MENSAGEM — Lead descartado da fila prioritária.",
        status_dia: "bloqueado_optout",
        adaptation_reason: "Lead marcado como descartado/fora de perfil.",
        mensagem: "[LEAD ARQUIVADO]: Registro fora do perfil prioritário no momento.",
        objecao_provavel: "Lead fora do escopo.",
        resposta_sugerida: "Nenhuma ação.",
        cta: "Não aplicável",
      };
    }

    // Caso de Empresa Já Respondeu
    if (historyStage === "empresa_respondeu" && isCurrentActiveDay) {
      const replyAdaptedMsg = `Oi, pessoal da ${companyName}! Obrigado pelo retorno.\n\nPara eu ser bem objetivo e respeitar o tempo de vocês: hoje, quando pensam em ${service} aí em ${city}, qual é o principal desafio que gostariam de resolver primeiro?\n\nCom base nisso, já te digo na hora se o formato que estruturamos se encaixa no momento de vocês.`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo: `Dia ${blueprint.dia} (Adaptado) — Resposta Consultiva e Qualificação`,
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Resposta Consultiva e Qualificação`,
        objetivo: "Responder com naturalidade ao retorno da empresa e qualificar o cenário atual",
        acao_sugerida: "Responder à mensagem da empresa fazendo 1 pergunta de diagnóstico leve",
        status_dia: "adaptado",
        adaptation_reason: "A empresa já respondeu ao contato. Mensagem fria substituída por condução consultiva.",
        mensagem: replyAdaptedMsg,
        objecao_provavel: "Não tenho certeza se é o momento de contratar.",
        resposta_sugerida: "Totalmente compreensível. Vamos só avaliar o cenário primeiro sem compromisso.",
        cta: "Qual é o principal desafio hoje?",
      };
    }

    // Caso de Reunião Marcada
    if (historyStage === "reuniao_marcada" && isCurrentActiveDay) {
      const meetingMsg = `Olá, ${companyName}! Confirmando nossa conversa sobre ${service} em ${city}. Já deixei separados os pontos principais para avaliarmos juntos de forma objetiva. Até já!`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo: `Dia ${blueprint.dia} (Adaptado) — Confirmação e Preparação da Reunião`,
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Confirmação e Preparação da Reunião`,
        objetivo: "Confirmar presença e conduzir conversa objetiva de diagnóstico",
        acao_sugerida: "Enviar confirmação de horário no WhatsApp",
        status_dia: "adaptado",
        adaptation_reason: "Reunião agendada! O plano substituiu follow-up por confirmação.",
        mensagem: meetingMsg,
        objecao_provavel: "Preciso remarcar para outro dia.",
        resposta_sugerida: "Sem problemas! Qual dia e horário fica melhor para você?",
        cta: "Confirmado para o nosso horário?",
      };
    }

    // Caso de Empresa Interessada
    if (historyStage === "empresa_interessada" && isCurrentActiveDay) {
      const interestedMsg = `Oi, ${companyName}! Que bom saber do interesse.\n\nPara alinharmos de forma prática: você prefere que eu te envie um resumo com escopo e valores por aqui ou fica mais fácil falarmos 10 minutos por telefone?`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo: `Dia ${blueprint.dia} (Adaptado) — Avanço Comercial e Alinhamento de Proposta`,
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Avanço Comercial e Alinhamento de Proposta`,
        objetivo: "Conduzir o interesse demonstrado para proposta ou conversa rápida",
        acao_sugerida: "Enviar opções de continuidade para a empresa escolher",
        status_dia: "adaptado",
        adaptation_reason: "Empresa demonstrou interesse! Priorizar avanço comercial.",
        mensagem: interestedMsg,
        objecao_provavel: "Depende do preço.",
        resposta_sugerida: "Claro! Nosso modelo é enxuto e adaptado ao porte do negócio. Posso te enviar as faixas por aqui?",
        cta: "Prefere resumo por mensagem ou alinhamento rápido por telefone?",
      };
    }

    // Fluxo padrão
    const statusDia: PlanoProspeccaoDia["status_dia"] = isCompleted
      ? "concluido"
      : isCurrentActiveDay
      ? "disponivel"
      : "pendente";

    // Preserva mensagem existente salva pelo usuário, se houver
    const finalMessage = existingDay?.mensagem && existingDay.mensagem.trim().length > 10
      ? existingDay.mensagem
      : blueprint.defaultMessage;

    return {
      ...existingDay,
      dia: blueprint.dia,
      canal: blueprint.canal,
      titulo_dia: blueprint.titulo_dia,
      objetivo: blueprint.objetivo,
      acao_sugerida: blueprint.acao_sugerida,
      explicacao_tarefa: blueprint.explicacao_tarefa,
      status_dia: statusDia,
      mensagem: finalMessage,
      assunto_email: blueprint.assunto_email,
      objecao_provavel: blueprint.objecao_provavel,
      resposta_sugerida: blueprint.resposta_sugerida,
      cta: blueprint.cta,
    };
  });

  let proximaAcaoGlobal = "";
  let resumoContinuidade = "";

  if (isOptedOutOrRefused) {
    proximaAcaoGlobal = "Nenhuma ação comercial: respeitar opt-out/recusa registrado. Proibido enviar qualquer mensagem.";
    resumoContinuidade = "Sequência encerrada imediatamente para evitar insistência comercial indesejada.";
  } else if (isDiscardedWithoutOptOut) {
    proximaAcaoGlobal = "Lead arquivado por falta de aderência comercial.";
    resumoContinuidade = "Lead fora do perfil prioritário no momento.";
  } else if (historyStage === "reuniao_marcada") {
    proximaAcaoGlobal = `Confirmar conversa agendada com ${companyName}.`;
    resumoContinuidade = "Plano adaptado para confirmação de reunião.";
  } else if (historyStage === "empresa_interessada") {
    proximaAcaoGlobal = `Apresentar opções de proposta ou alinhamento rápido para ${companyName}.`;
    resumoContinuidade = "Plano priorizado para conversão de lead interessado.";
  } else if (historyStage === "empresa_respondeu") {
    proximaAcaoGlobal = `Responder ao retorno da ${companyName} com a pergunta de diagnóstico.`;
    resumoContinuidade = "Mensagens frias desativadas porque a empresa já respondeu.";
  } else if (firstUncompletedDay !== null) {
    const activeDayObj = adaptedDays.find((d) => d.dia === firstUncompletedDay);
    proximaAcaoGlobal = `Executar Dia ${firstUncompletedDay}: ${activeDayObj?.acao_sugerida || "Próxima etapa do plano"}`;
    resumoContinuidade = completedSet.size === 0
      ? "Nenhuma etapa concluída ainda. Comece pelo Dia 1 sem pular etapas."
      : `${completedSet.size} de 7 etapas concluídas. Retome do Dia ${firstUncompletedDay}.`;
  } else {
    proximaAcaoGlobal = "Ciclo de 7 dias finalizado! Avalie arquivar ou agendar revisão futura.";
    resumoContinuidade = "Todas as 7 etapas do plano foram concluídas.";
  }

  const isBlocked = isOptedOutOrRefused || isDiscardedWithoutOptOut;

  return {
    leadId: lead.id || companyName,
    companyName,
    userServiceName: service,
    historyStage,
    historyStageLabel: getHistoryStageLabel(historyStage),
    isOptedOutOrRefused,
    currentRecommendedDay: isBlocked ? null : firstUncompletedDay,
    proximaAcaoGlobal,
    resumoContinuidade,
    days: adaptedDays,
    diagnostico: buildStructuredDiagnosis(lead, service).diagnostico,
    probabilidade: buildStructuredDiagnosis(lead, service).probabilidade,
  };
}

/**
 * Função central de extração da mensagem para o SDR:
 * GARANTE QUE: mensagem do Dia X no plano === mensagem inicialmente carregada pelo SDR no Dia X.
 */
export function getSdrMessageFromPlan(
  lead: Partial<LeadProspeccao>,
  dayNumber = 1,
  userServiceName = "gestão de tráfego e presença digital"
): {
  message: string;
  canal: "whatsapp" | "email" | "instagram";
  assuntoEmail: string;
  acaoSugerida: string;
  objetivo: string;
  isOptedOut: boolean;
  dayNumber: number;
  totalDays: number;
} {
  const planResult = buildIntelligentPlan({
    lead,
    userServiceName,
    existingPlan: lead.plano_prospecao_7dias,
  });

  const targetDay = planResult.days.find((d) => d.dia === dayNumber) || planResult.days[0];
  const isOptedOut = planResult.isOptedOutOrRefused;

  let assuntoEmail = targetDay?.assunto_email || "";
  let message = targetDay?.mensagem || "";

  // Se a mensagem contiver "Assunto: ...", extrai para o campo de assunto de forma limpa
  if (message.startsWith("Assunto:")) {
    const parts = message.split(/\n\n|\r\n\r\n/);
    if (parts.length >= 2) {
      assuntoEmail = parts[0].replace(/^Assunto:\s*/i, "").trim();
      message = parts.slice(1).join("\n\n").trim();
    }
  }

  if (isOptedOut) {
    message = "";
  }

  return {
    message,
    text: message,
    canal: targetDay?.canal || "whatsapp",
    assuntoEmail,
    acaoSugerida: targetDay?.acao_sugerida || "Abertura comercial",
    objetivo: targetDay?.objetivo || "Iniciar conversa",
    isOptedOut,
    dayNumber: targetDay?.dia || dayNumber,
    totalDays: planResult.days.length,
  };
}

/**
 * Extrai assunto e corpo de e-mail de uma mensagem composta.
 */
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
  return {
    subject: defaultSubject,
    body: trimmed,
  };
}
