import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import { normalizePlanoProspeccao } from "@/utils/normalizeLead";
import {
  generateAllSdrStyleVariations,
  resolveServiceArgumentProfile,
  sanitizeBrazilianPhoneNumber,
  type SdrApproachStyle,
} from "./sdrProspectingService";

export type LeadHistoryStage =
  | "nao_contatado"
  | "contato_iniciado_sem_resposta"
  | "empresa_respondeu"
  | "empresa_interessada"
  | "reuniao_marcada"
  | "recusa_ou_optout"
  | "descartado_sem_optout";

export interface SevenDayExecutionState {
  userId: string;
  leadId: string;
  completedDays: number[];
  currentHistoryStage: LeadHistoryStage;
  lastUpdatedIso: string;
  customDayNotes: Record<number, string>;
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
}

export interface BuildIntelligentPlanOptions {
  lead: Partial<LeadProspeccao>;
  userServiceName?: string;
  preferredStyle?: SdrApproachStyle;
  existingPlan?: PlanoProspeccaoDia[] | null;
  executionState?: Partial<SevenDayExecutionState> | null;
  overrideHistoryStage?: LeadHistoryStage;
}

const PLAN_STATE_STORAGE_PREFIX = "zuno_next_7day_state_";
const planMemoryMap = new Map<string, string>();

const planMemoryFallback: Pick<Storage, "getItem" | "setItem"> = {
  getItem: (key: string) => (planMemoryMap.has(key) ? planMemoryMap.get(key)! : null),
  setItem: (key: string, value: string) => {
    planMemoryMap.set(key, value);
  },
};

export function clearSevenDayPlanMemoryStorage(): void {
  planMemoryMap.clear();
}

function getSafeStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage errors
  }
  return planMemoryFallback;
}

/**
 * Verifica se o lead possui recusa ou opt-out registrado de forma explícita.
 * Esta verificação tem PRIORIDADE ABSOLUTA sobre cache local, simulações e status padrão.
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
 * Detecta o estágio real de histórico do lead a partir do status e das anotações,
 * garantindo que o plano nunca sugira primeiro contato se já houve resposta ou recusa.
 *
 * REGRAS DE SEGURANÇA E PRECISÃO:
 * 1. Opt-out explícito tem prioridade máxima.
 * 2. sem_resposta NÃO é opt-out nem descartado (apenas contato iniciado aguardando retorno).
 * 3. descartado sem menção de recusa explícita é tratado como 'descartado_sem_optout' (fora de perfil).
 * 4. perdido, recusou, pediu para não contatar e sem resposta NÃO são sinônimos.
 */
export function resolveLeadHistoryStage(
  lead: Partial<LeadProspeccao>,
  overrideStage?: LeadHistoryStage
): LeadHistoryStage {
  // 1. Prioridade absoluta para opt-out / recusa explícita
  if (hasExplicitOptOut(lead)) {
    return "recusa_ou_optout";
  }

  if (overrideStage) return overrideStage;

  const rawStatus = String(lead.status || "novo").toLowerCase().trim();
  const rawNotes = String(lead.notas || "").toLowerCase();

  // 2. Reunião marcada / Negociação
  if (
    rawStatus === "reuniao_marcada" ||
    rawStatus === "negociacao" ||
    rawNotes.includes("status: reuniao_marcada")
  ) {
    return "reuniao_marcada";
  }

  // 3. Empresa demonstrou interesse / Qualificação
  if (
    rawStatus === "interessado" ||
    rawStatus === "qualificacao" ||
    rawNotes.includes("status: interessado")
  ) {
    return "empresa_interessada";
  }

  // 4. Empresa respondeu
  if (rawStatus === "respondeu" || rawNotes.includes("status: respondeu")) {
    return "empresa_respondeu";
  }

  // 5. Contato já iniciado ou aguardando retorno (sem_resposta não é opt-out nem descarte)
  if (
    rawStatus === "abertura_iniciada" ||
    rawStatus === "em_contato" ||
    rawStatus === "contato_realizado" ||
    rawStatus === "sem_resposta" ||
    rawNotes.includes("status: abertura_iniciada") ||
    rawNotes.includes("status: contato_realizado") ||
    rawNotes.includes("status: sem_resposta")
  ) {
    return "contato_iniciado_sem_resposta";
  }

  // 6. Descartado sem opt-out (lead fora de perfil ou dados inválidos)
  if (rawStatus === "descartado" || rawNotes.includes("status: descartado")) {
    return "descartado_sem_optout";
  }

  // 7. Perdido sem menção de opt-out
  if (rawStatus === "perdido" || rawNotes.includes("status: perdido")) {
    return "descartado_sem_optout";
  }

  return "nao_contatado";
}

export function getHistoryStageLabel(stage: LeadHistoryStage): string {
  switch (stage) {
    case "nao_contatado":
      return "Ainda não contatado (Pronto para Dia 1)";
    case "contato_iniciado_sem_resposta":
      return "Contato iniciado • Aguardando resposta (Follow-up sem pressão)";
    case "empresa_respondeu":
      return "Empresa respondeu • Triagem e continuidade consultiva";
    case "empresa_interessada":
      return "Interesse demonstrado • Preparar conversa rápida / proposta";
    case "reuniao_marcada":
      return "Reunião agendada • Preparação diagnóstica e proposta";
    case "recusa_ou_optout":
      return "Recusa / Opt-out registrado • Contatos permanentemente interrompidos";
    case "descartado_sem_optout":
      return "Descartado sem opt-out • Fora de perfil comercial";
  }
}

/**
 * Carrega o estado de execução do plano de 7 dias isolado por userId e leadId.
 * Se o lead possui opt-out explícito no registro, o opt-out NUNCA pode ser revertido por cache local.
 */
export function loadSevenDayExecutionState(
  userId: string,
  leadId: string,
  lead?: Partial<LeadProspeccao>
): SevenDayExecutionState {
  const safeUser = (userId || "anonymous").trim();
  const safeLead = (leadId || "default_lead").trim();
  const key = `${PLAN_STATE_STORAGE_PREFIX}${safeUser}_${safeLead}`;
  const storage = getSafeStorage();
  const leadHasOptOut = lead ? hasExplicitOptOut(lead) : false;

  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as SevenDayExecutionState;
        const resolvedStage = leadHasOptOut
          ? "recusa_ou_optout"
          : parsed.currentHistoryStage || resolveLeadHistoryStage(lead || {});
        return {
          userId: safeUser,
          leadId: safeLead,
          completedDays: Array.isArray(parsed.completedDays) ? parsed.completedDays : [],
          currentHistoryStage: resolvedStage,
          lastUpdatedIso: parsed.lastUpdatedIso || new Date().toISOString(),
          customDayNotes: parsed.customDayNotes || {},
        };
      }
    } catch {
      // fallback to fresh state
    }
  }

  return {
    userId: safeUser,
    leadId: safeLead,
    completedDays: [],
    currentHistoryStage: leadHasOptOut ? "recusa_ou_optout" : resolveLeadHistoryStage(lead || {}),
    lastUpdatedIso: new Date().toISOString(),
    customDayNotes: {},
  };
}

/**
 * Salva o progresso de um dia ou transição de histórico isolado por userId e leadId.
 * Se uma etapa não foi concluída, nunca avança artificialmente os dias seguintes.
 */
export function saveSevenDayExecutionState(state: SevenDayExecutionState): SevenDayExecutionState {
  const safeUser = (state.userId || "anonymous").trim();
  const safeLead = (state.leadId || "default_lead").trim();
  const key = `${PLAN_STATE_STORAGE_PREFIX}${safeUser}_${safeLead}`;
  const storage = getSafeStorage();

  const normalized: SevenDayExecutionState = {
    ...state,
    userId: safeUser,
    leadId: safeLead,
    completedDays: Array.from(new Set(state.completedDays)).sort((a, b) => a - b),
    lastUpdatedIso: new Date().toISOString(),
  };

  if (storage) {
    storage.setItem(key, JSON.stringify(normalized));
  }

  return normalized;
}

/**
 * Marca ou desmarca um dia específico como concluído, preservando o histórico real.
 */
export function toggleSevenDayStepCompletion({
  userId,
  leadId,
  dayNumber,
  completed,
  lead,
}: {
  userId: string;
  leadId: string;
  dayNumber: number;
  completed: boolean;
  lead?: Partial<LeadProspeccao>;
}): SevenDayExecutionState {
  const current = loadSevenDayExecutionState(userId, leadId, lead);
  const set = new Set(current.completedDays);
  if (completed) {
    set.add(dayNumber);
  } else {
    set.delete(dayNumber);
  }

  let nextStage = current.currentHistoryStage;
  if (completed && dayNumber === 1 && nextStage === "nao_contatado") {
    nextStage = "contato_iniciado_sem_resposta";
  }

  return saveSevenDayExecutionState({
    ...current,
    completedDays: Array.from(set),
    currentHistoryStage: nextStage,
  });
}

/**
 * Constrói o Plano Inteligente de 7 Dias preservando a estrutura de 7 dias e evoluindo:
 * - O que fazer em cada dia;
 * - Como executar a tarefa;
 * - Qual mensagem usar conforme o serviço do assinante e o histórico real do lead.
 */
export function buildIntelligentSevenDayPlan({
  lead,
  userServiceName = "gestão de tráfego e presença digital",
  preferredStyle = "consultivo",
  existingPlan,
  executionState,
  overrideHistoryStage,
}: BuildIntelligentPlanOptions): IntelligentSevenDayPlanResult {
  const companyName = lead.nome?.trim() || "Empresa";
  const city =
    lead.cidade && lead.cidade.trim().toLowerCase() !== "não informada"
      ? lead.cidade.trim()
      : "sua região";
  const niche =
    lead.nicho && lead.nicho.trim().toLowerCase() !== "não informado"
      ? lead.nicho.trim()
      : "seu segmento";
  const service =
    userServiceName.trim() ||
    (lead.foco && lead.foco !== "zuno_internal_prospecting"
      ? lead.foco
      : "gestão de tráfego e presença digital");

  const hasWebsite = Boolean(
    lead.website && lead.website.trim().length > 4 && !lead.website.includes("facebook.com")
  );
  const phoneInfo = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);
  const hasIncompleteData = !hasWebsite && !phoneInfo.isValid;

  const basePlanRaw = existingPlan && existingPlan.length > 0
    ? existingPlan
    : normalizePlanoProspeccao(lead.plano_prospecao_7dias, lead);

  // Prioridade absoluta para opt-out explícito nos dados reais do lead
  const leadHasRealOptOut = hasExplicitOptOut(lead);
  const historyStage = leadHasRealOptOut
    ? "recusa_ou_optout"
    : resolveLeadHistoryStage(
        lead,
        overrideHistoryStage || executionState?.currentHistoryStage
      );

  const serviceProfile = resolveServiceArgumentProfile(service, niche, city, hasWebsite);
  const sdrStyles = generateAllSdrStyleVariations({
    lead,
    userServiceName: service,
  });

  // Conjunto de dias efetivamente concluídos pelo assinante
  const completedSet = new Set<number>(executionState?.completedDays || []);
  if (
    historyStage !== "nao_contatado" &&
    historyStage !== "recusa_ou_optout" &&
    historyStage !== "descartado_sem_optout" &&
    completedSet.size === 0
  ) {
    // Se já houve contato registrado no status do lead, o Dia 1 (abertura) já ocorreu
    completedSet.add(1);
  }

  const isOptedOutOrRefused = historyStage === "recusa_ou_optout";
  const isDiscardedWithoutOptOut = historyStage === "descartado_sem_optout";

  // Definição rica e estruturada dos 7 dias preservando a cadência de 7 etapas
  const richDaysBlueprint: Array<{
    dia: number;
    canal: "whatsapp" | "instagram" | "email";
    titulo_dia: string;
    objetivo: string;
    acao_sugerida: string;
    explicacao_tarefa: string;
    informacoes_necessarias: string[];
    criterio_conclusao: string;
    proxima_acao_sugerida: string;
    condicao_aplicacao: string;
    defaultMessage: string;
    variations: {
      consultivo: string;
      direto: string;
      exemplo_pratico: string;
    };
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
  }> = [
    {
      dia: 1,
      canal: "whatsapp",
      titulo_dia: "Dia 1 — Qualificação do Dossiê e Primeira Abordagem Personalizada",
      objetivo: `Validar os dados verificados da ${companyName} e iniciar o primeiro contato sobre ${service} sem parecer template automático`,
      acao_sugerida: hasIncompleteData
        ? "Conferir canal disponível e enviar abertura neutra de identificação do responsável"
        : "Revisar o Dossiê Comercial e abrir conversa no WhatsApp com a abordagem personalizada",
      explicacao_tarefa: hasIncompleteData
        ? `Os dados públicos da ${companyName} estão incompletos (sem site ou celular confirmado). Use uma abordagem neutra para confirmar quem responde pelo comercial antes de apresentar sua solução.`
        : `Confira o bloco 'O QUE SABEMOS' no dossiê, escolha o tom (${preferredStyle}) e clique em 'Abrir no meu WhatsApp' para enviar a primeira mensagem.`,
      informacoes_necessarias: [
        phoneInfo.isValid ? `Telefone verificado: ${phoneInfo.formattedDisplay}` : "Telefone pendente de validação",
        `Segmento: ${niche} em ${city}`,
        `Serviço: ${service}`,
      ],
      criterio_conclusao: "Mensagem de abertura enviada manualmente no WhatsApp e status registrado.",
      proxima_acao_sugerida: "Aguardar 24h. Se a empresa responder, avançar para triagem consultiva; se não responder, executar o Dia 2.",
      condicao_aplicacao: "Aplicável quando a empresa ainda não foi contatada.",
      defaultMessage: sdrStyles[preferredStyle].text,
      variations: {
        consultivo: sdrStyles.consultivo.text,
        direto: sdrStyles.direto.text,
        exemplo_pratico: sdrStyles.exemplo_pratico.text,
      },
      objecao_provavel: "Quem é você e como encontrou nosso contato?",
      resposta_sugerida: `Trabalho com ${service} para empresas de ${niche} e encontrei o contato público da ${companyName} pesquisando negócios de ${city}.`,
      cta: serviceProfile.lowFrictionQuestion,
    },
    {
      dia: 2,
      canal: "instagram",
      titulo_dia: "Dia 2 — Observação de Presença Digital e Contexto Local",
      objetivo: "Complementar a leitura dos canais públicos da empresa sem fingir intimidade",
      acao_sugerida: "Verificar perfil/site da empresa e registrar um ponto real de observação",
      explicacao_tarefa: `Visite o canal público da ${companyName} e veja se há informações sobre os serviços principais em ${city}. Nunca diga 'acompanho vocês há tempos' se não for verdade; comente apenas o que realmente observou.`,
      informacoes_necessarias: [
        hasWebsite ? `Website cadastrado: ${lead.website}` : "Busca do perfil público da empresa",
        "Registro do contato do Dia 1",
      ],
      criterio_conclusao: "Canal secundário verificado ou nota contextual enviada sem insistência.",
      proxima_acao_sugerida: "Se houver resposta em qualquer canal, focar no atendimento; se não houver, preparar o resumo do Dia 3.",
      condicao_aplicacao: "Aplicável se o Dia 1 foi executado e a empresa ainda não respondeu.",
      defaultMessage: `Olá, pessoal da ${companyName}! Vi a atuação de vocês em ${niche} aqui em ${city}. Trabalho com ${service} (${serviceProfile.coreAngle}) e gostaria de saber quem cuida dessa área aí na empresa para compartilhar uma ideia rápida.`,
      variations: {
        consultivo: `Olá, pessoal da ${companyName}! Vi a atuação de vocês em ${niche} em ${city}. Trabalho com ${service} e estruturei uma ideia prática sobre ${serviceProfile.coreAngle}. Quem seria a pessoa ideal aí na equipe para avaliar isso rapidamente?`,
        direto: `Oi, equipe da ${companyName}! Atuo com ${service} para ${niche} em ${city}. Quem é o responsável pela parte comercial ou de marketing para eu compartilhar uma ideia objetiva?`,
        exemplo_pratico: `Olá, pessoal da ${companyName}! Organizei um resumo prático sobre ${serviceProfile.coreAngle} pensado para negócios de ${niche} em ${city}. Posso encaminhar os pontos principais por aqui para o responsável?`,
      },
      objecao_provavel: "No momento não estamos contratando novos fornecedores.",
      resposta_sugerida: "Perfeito, agradeço o retorno! Se quiserem apenas receber um resumo em 3 pontos como referência para quando o tema voltar à pauta, envio sem compromisso.",
      cta: "Quem cuida dessa frente aí na empresa?",
    },
    {
      dia: 3,
      canal: "email",
      titulo_dia: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
      objetivo: "Apresentar uma hipótese comercial clara baseada no serviço oferecido, sem jargões técnicos",
      acao_sugerida: "Enviar mensagem ou e-mail curto conectando seu serviço à rotina da empresa",
      explicacao_tarefa: `Use o ângulo principal de ${serviceProfile.categoryLabel} para mostrar como você ajuda empresas de ${niche} em ${city} de forma objetiva.`,
      informacoes_necessarias: [
        "E-mail comercial ou canal principal de texto",
        `Hipótese comercial: ${serviceProfile.coreAngle}`,
      ],
      criterio_conclusao: "Mensagem consultiva enviada ou adaptada ao retorno do lead.",
      proxima_acao_sugerida: "Aguardar retorno antes do acompanhamento leve do Dia 4.",
      condicao_aplicacao: "Aplicável para consolidar o motivo comercial do contato.",
      defaultMessage: `Assunto: Ideia prática para a ${companyName} em ${city}\n\nOlá, equipe da ${companyName},\n\nObservei a atuação de vocês no segmento de ${niche} em ${city}.\n\n${serviceProfile.consultativeValueLine}\n\nFaz sentido trocarmos uma ideia rápida sobre como isso funciona na prática?`,
      variations: {
        consultivo: `Assunto: Ideia prática para a ${companyName} em ${city}\n\nOlá, equipe da ${companyName},\n\nObservei a atuação de vocês no segmento de ${niche} em ${city}.\n\n${serviceProfile.consultativeValueLine}\n\nFaz sentido trocarmos uma ideia rápida sobre essa frente?`,
        direto: `Assunto: ${service} para ${companyName} (${city})\n\nOlá,\n\n${serviceProfile.directObjectiveLine}\n\nPosso compartilhar um resumo objetivo de como estruturamos isso por aqui?`,
        exemplo_pratico: `Assunto: Resumo prático para ${companyName}\n\nOlá, pessoal da ${companyName},\n\n${serviceProfile.practicalExampleLine}\n\n${serviceProfile.lowFrictionQuestion}`,
      },
      objecao_provavel: "Qual é o valor do serviço?",
      resposta_sugerida: "O formato depende da meta atual de vocês na cidade. Por isso sugiro primeiro alinharmos os pontos principais para avaliarem se o modelo faz sentido antes de falarmos de proposta.",
      cta: "Faz sentido trocarmos uma ideia rápida sobre isso por aqui?",
    },
    {
      dia: 4,
      canal: "whatsapp",
      titulo_dia: "Dia 4 — Acompanhamento Consultivo com Pergunta de Diagnóstico (Sem Cobrança)",
      objetivo: "Retomar o contato com uma pergunta inteligente sobre o nicho, sem cobrar leitura anterior",
      acao_sugerida: "Enviar pergunta leve e útil conectada à rotina da empresa",
      explicacao_tarefa: "Regra de ouro do Dia 4: jamais escreva 'passando para saber se viu minha mensagem'. Faça uma pergunta simples sobre como a empresa recebe novos clientes hoje.",
      informacoes_necessarias: [
        "Confirmação de que não houve resposta nem recusa nos dias 1 a 3",
        "Pergunta investigativa do Dossiê Comercial",
      ],
      criterio_conclusao: "Pergunta consultiva enviada no WhatsApp sem tom de cobrança.",
      proxima_acao_sugerida: "Se responder à pergunta, aprofundar conversa; se não responder, avançar para o exemplo prático no Dia 5.",
      condicao_aplicacao: "Aplicável apenas quando o lead ainda não respondeu após o primeiro contato.",
      defaultMessage: `Oi, pessoal da ${companyName}! Tudo bem?\n\nDeixando uma pergunta rápida sobre a rotina de vocês em ${city}: hoje a maior parte dos novos clientes de ${niche} chega por indicação ou pelas buscas digitais da região?\n\nPergunto porque estruturei um passo a passo sobre ${serviceProfile.coreAngle} bem focado nisso.`,
      variations: {
        consultivo: `Oi, pessoal da ${companyName}! Tudo bem?\n\nDeixando uma pergunta rápida sobre a rotina de vocês em ${city}: hoje a maior parte dos novos clientes de ${niche} chega por indicação ou pelas buscas digitais da região?\n\nPergunto porque tenho algumas ideias práticas sobre ${serviceProfile.coreAngle}.`,
        direto: `Oi, ${companyName}! Para eu saber se faz sentido conversarmos sobre ${service}: hoje vocês já têm alguém cuidando de ${serviceProfile.coreAngle} em ${city}?`,
        exemplo_pratico: `Olá, equipe da ${companyName}! Separei um resumo em 3 pontos mostrando como empresas de ${niche} em ${city} organizam ${serviceProfile.coreAngle}. Querem que eu deixe esse resumo por aqui para verem quando tiverem um tempinho?`,
      },
      objecao_provavel: "A semana está muito corrida por aqui.",
      resposta_sugerida: "Imagino perfeitamente! Por isso mesmo resumi a ideia em 3 pontos objetivos em texto para você ver no seu tempo, sem precisar marcar reunião.",
      cta: "Quer que eu deixe o resumo de 3 pontos registrado aqui?",
    },
    {
      dia: 5,
      canal: "email",
      titulo_dia: "Dia 5 — Entrega de Exemplo Prático Tangível do Segmento",
      objetivo: "Demonstrar competência técnica com clareza, sem inventar estudos de caso ou percentuais falsos",
      acao_sugerida: "Descrever em 3 pontos simples como a solução funciona para o segmento",
      explicacao_tarefa: `Apresente os 3 passos práticos que você executa em ${service} para clientes de ${niche}, mantendo 100% de honestidade factual.`,
      informacoes_necessarias: [
        `Estrutura de entrega de ${service}`,
        `Contexto local de ${city}`,
      ],
      criterio_conclusao: "Explicação prática enviada e registrada no histórico do lead.",
      proxima_acao_sugerida: "Monitorar resposta e preparar validação de prioridade no Dia 6.",
      condicao_aplicacao: "Aplicável para dar visibilidade concreta ao trabalho do assinante.",
      defaultMessage: `Olá, pessoal da ${companyName}!\n\nPara ser bem prático sobre como trabalho com ${service} para ${niche} em ${city}, nossa rotina foca em 3 pontos:\n1. Clareza na apresentação para quem procura o serviço na região;\n2. Direcionamento rápido para o WhatsApp comercial;\n3. Acompanhamento simples dos pedidos de orçamento.\n\nSe quiserem ver essa estrutura aplicada à realidade da ${companyName}, me avisem por aqui.`,
      variations: {
        consultivo: `Olá, pessoal da ${companyName}!\n\nResumindo de forma prática como apoiamos empresas de ${niche} em ${city} com ${service}: focamos em ${serviceProfile.coreAngle}, facilitando a chegada de contatos prontos no WhatsApp.\n\nFaz sentido trocarmos uma ideia rápida sobre isso?`,
        direto: `Oi, equipe da ${companyName}! Deixando de forma resumida nossa atuação em ${service} para ${niche} em ${city}: estruturamos ${serviceProfile.coreAngle} sem complicar a rotina da sua equipe. Posso enviar os detalhes por aqui?`,
        exemplo_pratico: `Olá, pessoal da ${companyName}! Montei um resumo em 3 pontos mostrando como organizamos ${serviceProfile.coreAngle} para ${niche} em ${city}. Posso colar esse passo a passo aqui para avaliarem?`,
      },
      objecao_provavel: "Já temos uma pessoa ou agência que cuida disso.",
      resposta_sugerida: "Excelente que já tenham essa estrutura! Caso queiram apenas uma segunda visão pontual sobre " + serviceProfile.coreAngle + ", fico à disposição.",
      cta: "Faz sentido avaliarmos esses 3 pontos na realidade de vocês?",
    },
    {
      dia: 6,
      canal: "instagram",
      titulo_dia: "Dia 6 — Validação Respeitosa de Momento e Prioridade",
      objetivo: "Confirmar se o tema é prioridade agora ou se deve ficar para um próximo momento",
      acao_sugerida: "Enviar pergunta curta de validação de timing comercial",
      explicacao_tarefa: "Pergunte com transparência se faz sentido avaliar o tema neste mês ou se a empresa está focada em outra prioridade.",
      informacoes_necessarias: ["Histórico de interações dos dias 1 a 5"],
      criterio_conclusao: "Pergunta de validação de prioridade realizada.",
      proxima_acao_sugerida: "Se confirmar interesse, avançar para conversa; se não responder, encerrar ciclo no Dia 7.",
      condicao_aplicacao: "Aplicável quando ainda não houve definição de interesse.",
      defaultMessage: `Oi, equipe da ${companyName}! Para eu respeitar o tempo de vocês: melhorar ${serviceProfile.coreAngle} aí em ${city} é algo que faz sentido avaliar neste mês ou hoje o foco da empresa está em outra área?`,
      variations: {
        consultivo: `Oi, equipe da ${companyName}! Para eu respeitar o tempo de vocês: melhorar ${serviceProfile.coreAngle} aí em ${city} é algo que faz sentido avaliar neste mês ou hoje o foco da empresa está em outra área?`,
        direto: `Olá, ${companyName}! Avaliar novas frentes de ${service} em ${city} entra no radar de vocês para este mês ou preferem que eu retome mais adiante?`,
        exemplo_pratico: `Oi, pessoal da ${companyName}! Antes de eu encerrar meus contatos por aqui: vale eu deixar o resumo prático sobre ${service} para analisarem este mês?`,
      },
      objecao_provavel: "Neste mês estamos focados em outra demanda interna.",
      resposta_sugerida: "Perfeito, foco é fundamental! Posso deixar anotado para retomar o contato daqui a 60 dias sem incomodar vocês agora.",
      cta: "Faz sentido para este mês ou melhor deixarmos para depois?",
    },
    {
      dia: 7,
      canal: "whatsapp",
      titulo_dia: "Dia 7 — Encerramento Elegante do Ciclo e Organização do CRM",
      objetivo: "Encerrar a sequência de 7 dias com profissionalismo, sem pressão e mantendo portas abertas",
      acao_sugerida: "Enviar nota cordial de encerramento e atualizar o status do lead",
      explicacao_tarefa: "Envie uma mensagem curta encerrando as tentativas para não gerar desgaste e atualize o status do lead para manter sua fila limpa.",
      informacoes_necessarias: ["Status consolidado após os 6 dias"],
      criterio_conclusao: "Mensagem de encerramento enviada (se sem resposta) e status atualizado no pipeline.",
      proxima_acao_sugerida: "Focar nas próximas empresas prioritárias da sua Missão Comercial.",
      condicao_aplicacao: "Última etapa do ciclo de 7 dias.",
      defaultMessage: `Oi, pessoal da ${companyName}! Passando apenas para encerrar meus contatos por aqui e não tomar o tempo de vocês na correria do dia a dia.\n\nSe em algum momento quiserem avaliar ideias práticas de ${service} para ${niche} em ${city}, meu contato fica à disposição.\n\nDesejo ótimos negócios para toda a equipe!`,
      variations: {
        consultivo: `Oi, pessoal da ${companyName}! Passando apenas para encerrar meus contatos por aqui e não tomar o tempo de vocês na correria do dia a dia.\n\nSe em algum momento quiserem avaliar ideias práticas de ${service} para ${niche} em ${city}, meu contato fica à disposição. Ótimos negócios!`,
        direto: `Olá, equipe da ${companyName}! Encerrando meus contatos por aqui para não incomodar. Quando quiserem avaliar ${service} em ${city}, fico à disposição neste número. Sucesso!`,
        exemplo_pratico: `Oi, pessoal da ${companyName}! Vou encerrar meus contatos por aqui para respeitar a rotina de vocês. Se precisarem de ideias práticas sobre ${service} para ${niche} mais adiante, é só me chamar. Bom trabalho!`,
      },
      objecao_provavel: "Obrigado pela compreensão!",
      resposta_sugerida: `Imagina! Sucesso para vocês aí na ${companyName}.`,
      cta: "Fico à disposição quando precisarem. Um abraço!",
    },
  ];

  // Determina qual é o próximo dia recomendado na sequência normal (menor dia não concluído)
  let firstUncompletedDay: number | null = null;
  for (let d = 1; d <= 7; d++) {
    if (!completedSet.has(d)) {
      firstUncompletedDay = d;
      break;
    }
  }

  // Constrói os 7 dias aplicando a lógica de adaptação ao histórico real do lead
  const adaptedDays: PlanoProspeccaoDia[] = richDaysBlueprint.map((blueprint) => {
    const existingDay = basePlanRaw.find((item) => Number(item.dia) === blueprint.dia);
    const isCompleted = completedSet.has(blueprint.dia);
    const isCurrentActiveDay = blueprint.dia === firstUncompletedDay;

    // CASO 1: RECUSA OU OPT-OUT -> Bloqueia imediatamente qualquer sugestão de insistência
    if (isOptedOutOrRefused) {
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: blueprint.canal,
        titulo_dia: `${blueprint.titulo_dia} (Pausado — Opt-out/Recusa)`,
        objetivo: "Respeitar a decisão da empresa e impedir qualquer disparo de insistência.",
        acao_sugerida: "NÃO ENVIAR MENSAGEM — Contato encerrado por solicitação de opt-out/recusa.",
        explicacao_tarefa:
          "A empresa solicitou não receber contatos ou recusou a abordagem. O Zuno bloqueou permanentemente qualquer nova mensagem para proteger sua reputação.",
        informacoes_necessarias: ["Registro de recusa/opt-out no histórico do lead"],
        criterio_conclusao: "Ciclo permanentemente interrompido e arquivado com respeito.",
        proxima_acao_sugerida: "Nenhuma ação comercial permitida para este contato. Avance para o próximo lead.",
        condicao_aplicacao: "Bloqueado permanentemente por recusa ou opt-out.",
        status_dia: "bloqueado_optout",
        adaptation_reason:
          "Opt-out ou recusa registrado no lead. Todas as mensagens de follow-up foram desativadas.",
        mensagem:
          "[CONTATO INTERROMPIDO — RESPEITO AO OPT-OUT]: Esta empresa solicitou não receber contatos ou recusou a abordagem. Proibido enviar qualquer mensagem.",
        objecao_provavel: "Empresa pediu para não receber contatos.",
        resposta_sugerida: "Nenhuma resposta adicional necessária. Registro arquivado.",
        cta: "Não aplicável (Opt-out ativo)",
      };
    }

    // CASO 1.1: DESCARTADO SEM OPT-OUT -> Pausa ciclo sem marcar como recusa pessoal
    if (isDiscardedWithoutOptOut) {
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: blueprint.canal,
        titulo_dia: `${blueprint.titulo_dia} (Arquivado — Fora de Perfil)`,
        objetivo: "Lead arquivado por falta de aderência comercial sem solicitação explícita de opt-out.",
        acao_sugerida: "NÃO ENVIAR MENSAGEM — Lead descartado da fila prioritária.",
        explicacao_tarefa:
          "A empresa foi descartada por falta de aderência ao perfil ou dados insuficientes. Nenhuma ação comercial imediata recomendada.",
        informacoes_necessarias: ["Critérios de descarte no CRM"],
        criterio_conclusao: "Lead arquivado no pipeline.",
        proxima_acao_sugerida: "Priorizar empresas qualificadas na missão ativa.",
        condicao_aplicacao: "Lead descartado da missão.",
        status_dia: "bloqueado_optout",
        adaptation_reason: "Lead marcado como descartado/fora de perfil.",
        mensagem: "[LEAD ARQUIVADO]: Registro fora do perfil prioritário no momento.",
        objecao_provavel: "Lead fora do escopo.",
        resposta_sugerida: "Nenhuma ação.",
        cta: "Não aplicável",
      };
    }

    // CASO 2: EMPRESA JÁ RESPONDEU -> Adapta o dia ativo para Triagem Consultiva (NUNCA sugere mensagem de 1º contato)
    if (historyStage === "empresa_respondeu" && isCurrentActiveDay) {
      const replyAdaptedMsg = `Oi, pessoal da ${companyName}! Obrigado pelo retorno.\n\nPara eu ser bem objetivo e respeitar o tempo de vocês: hoje, quando pensam em ${serviceProfile.coreAngle} aí em ${city}, qual é o principal desafio que vocês gostariam de resolver primeiro?\n\nCom base nisso, já te digo na hora se o formato que estruturamos se encaixa no momento de vocês.`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Resposta Consultiva e Qualificação`,
        objetivo: "Responder com naturalidade ao retorno da empresa e entender o cenário atual sem parecer script frio",
        acao_sugerida: "Responder à mensagem da empresa fazendo 1 pergunta de diagnóstico leve",
        explicacao_tarefa:
          "Como a empresa já respondeu, o Zuno desativou as mensagens frias de prospecção e preparou uma resposta de continuidade para você qualificar a demanda.",
        informacoes_necessarias: [
          "Mensagem exata que a empresa enviou no WhatsApp",
          `Foco do seu serviço: ${service}`,
        ],
        criterio_conclusao: "Resposta enviada no WhatsApp e interesse qualificado.",
        proxima_acao_sugerida:
          "Se a empresa confirmar interesse, mudar status para 'Interessado' para liberar o roteiro de alinhamento.",
        condicao_aplicacao: "Ativado automaticamente porque o lead respondeu.",
        status_dia: "adaptado",
        adaptation_reason:
          "A empresa já respondeu ao contato. Mensagem de primeiro contato substituída por condução consultiva.",
        mensagem: replyAdaptedMsg,
        variations: {
          consultivo: replyAdaptedMsg,
          direto: `Obrigado pelo retorno, pessoal da ${companyName}! Posso te enviar aqui mesmo em texto um resumo objetivo de como estruturamos ${service} para ${niche} em ${city}?`,
          exemplo_pratico: `Obrigado por responderem! Segue a ideia principal: estruturamos ${serviceProfile.coreAngle} para empresas de ${niche} em ${city}. Faz sentido trocarmos uma ideia rápida ou preferem avaliar por mensagem aqui mesmo?`,
        },
        objecao_provavel: "Pode me explicar rapidamente por aqui mesmo como funciona?",
        resposta_sugerida: `Claro! Basicamente atuamos em ${serviceProfile.coreAngle}, ajudando a gerar conversas mais qualificadas no WhatsApp de vocês em ${city}.`,
        cta: "Qual é a prioridade principal de vocês nessa área hoje?",
      };
    }

    // CASO 3: EMPRESA DEMONSTROU INTERESSE -> Prioriza Preparação de Demonstração / Reunião Curta
    if (historyStage === "empresa_interessada" && isCurrentActiveDay) {
      const interestAdaptedMsg = `Que ótimo que faz sentido para o momento da ${companyName}!\n\nPara ser bem prático: posso te enviar agora o resumo aplicado à realidade de vocês em ${city} ou, se preferir, fazemos um alinhamento rápido de 15 minutos para eu mostrar os passos exatos de ${service}.\n\nQual formato fica mais confortável para a sua rotina: ver por aqui no WhatsApp ou falarmos rapidamente?`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Demonstração Prática e Convite de Alinhamento`,
        objetivo: "Converter o interesse demonstrado em análise prática ou conversa objetiva de 15 minutos",
        acao_sugerida: "Apresentar o exemplo prático e oferecer opção entre alinhamento por mensagem ou call de 15 min",
        explicacao_tarefa:
          "O lead demonstrou interesse! Revise os ângulos do Dossiê Comercial e conduza para a demonstração prática sem demora.",
        informacoes_necessarias: [
          "Dossiê Comercial da empresa revisado",
          "Disponibilidade para conversa rápida ou envio imediato da proposta",
        ],
        criterio_conclusao: "Demonstração enviada ou horário de conversa confirmado.",
        proxima_acao_sugerida: "Registrar 'Reunião Marcada' ou enviar proposta enxuta conforme preferência do cliente.",
        condicao_aplicacao: "Ativado automaticamente porque o lead demonstrou interesse.",
        status_dia: "adaptado",
        adaptation_reason:
          "Interesse confirmado pelo lead. O plano priorizou a preparação de demonstração e alinhamento comercial.",
        mensagem: interestAdaptedMsg,
        variations: {
          consultivo: interestAdaptedMsg,
          direto: `Excelente, pessoal da ${companyName}! Conseguimos falar 15 minutos entre hoje e amanhã para eu mostrar o plano prático de ${service} para ${city}, ou prefere que eu envie os pontos por aqui?`,
          exemplo_pratico: `Ótimo! Separei os 3 pontos práticos de ${service} aplicados à ${companyName} em ${city}. Prefere analisar por áudio/mensagem aqui no WhatsApp ou em uma conversa rápida de 15 minutos?`,
        },
        objecao_provavel: "Prefiro ver tudo por mensagem no WhatsApp sem reunião.",
        resposta_sugerida: "Perfeito, é ainda mais prático! Vou te mandar os 3 pontos objetivos aqui mesmo por mensagem para você avaliar no seu tempo.",
        cta: "Prefere ver por mensagem aqui mesmo ou falarmos 15 minutos?",
      };
    }

    // CASO 4: REUNIÃO MARCADA -> Roteiro de Diagnóstico e Fechamento
    if (historyStage === "reuniao_marcada" && isCurrentActiveDay) {
      const meetingMsg = `Oi, ${companyName}! Tudo confirmado para a nossa conversa sobre ${service} em ${city}.\n\nSeparei 3 pontos práticos especificamente sobre ${serviceProfile.coreAngle} no segmento de ${niche} para irmos direto ao que traz resultado para vocês.\n\nAté já!`;
      return {
        ...existingDay,
        dia: blueprint.dia,
        canal: "whatsapp",
        titulo_dia: `Dia ${blueprint.dia} (Adaptado) — Roteiro de Reunião e Proposta Comercial`,
        objetivo: "Confirmar presença, conduzir diagnóstico objetivo e apresentar proposta enxuta",
        acao_sugerida: "Confirmar horário no WhatsApp e revisar as perguntas investigativas do Dossiê",
        explicacao_tarefa:
          "Use as perguntas do bloco 'POSSÍVEIS ÂNGULOS COMERCIAIS' durante a conversa para validar a meta da empresa antes de apresentar o preço.",
        informacoes_necessarias: [
          "Horário agendado",
          "Perguntas de investigação do Dossiê Comercial",
          "Condições do seu serviço",
        ],
        criterio_conclusao: "Conversa realizada e resumo de próximos passos enviado.",
        proxima_acao_sugerida: "Enviar resumo pós-conversa com escopo e investimento.",
        condicao_aplicacao: "Ativado automaticamente porque há reunião/negociação em andamento.",
        status_dia: "adaptado",
        adaptation_reason:
          "Reunião agendada! O plano substituiu o follow-up por preparação de diagnóstico e confirmação.",
        mensagem: meetingMsg,
        variations: {
          consultivo: meetingMsg,
          direto: `Olá, ${companyName}! Confirmando nosso bate-papo. Já deixei separado o diagnóstico prático de ${service} para ${city}. Até logo!`,
          exemplo_pratico: `Oi, ${companyName}! Tudo pronto para nossa conversa. Vou compartilhar a tela/exemplo prático de ${serviceProfile.coreAngle} aplicado ao seu nicho. Até já!`,
        },
        objecao_provavel: "Preciso remarcar para outro horário.",
        resposta_sugerida: "Sem problema! Qual horário fica melhor para você amanhã? Se preferir, também posso adiantar o resumo por aqui.",
        cta: "Confirmado para o nosso horário?",
      };
    }

    // Fluxo padrão enriquecido (Respeitando dias concluídos, dia atual disponível e dias futuros pendentes)
    const statusDia: PlanoProspeccaoDia["status_dia"] = isCompleted
      ? "concluido"
      : isCurrentActiveDay
      ? "disponivel"
      : "pendente";

    return {
      ...existingDay,
      dia: blueprint.dia,
      canal: blueprint.canal,
      titulo_dia: blueprint.titulo_dia,
      objetivo: blueprint.objetivo,
      acao_sugerida: blueprint.acao_sugerida,
      explicacao_tarefa: blueprint.explicacao_tarefa,
      informacoes_necessarias: blueprint.informacoes_necessarias,
      criterio_conclusao: blueprint.criterio_conclusao,
      proxima_acao_sugerida: blueprint.proxima_acao_sugerida,
      condicao_aplicacao: blueprint.condicao_aplicacao,
      status_dia: statusDia,
      mensagem: blueprint.defaultMessage,
      variations: {
        ...existingDay?.variations,
        consultivo: blueprint.variations.consultivo,
        direto: blueprint.variations.direto,
        exemplo_pratico: blueprint.variations.exemplo_pratico,
        consultative: blueprint.variations.consultivo,
        direct: blueprint.variations.direto,
        light_provocation: blueprint.variations.exemplo_pratico,
      },
      objecao_provavel: blueprint.objecao_provavel,
      resposta_sugerida: blueprint.resposta_sugerida,
      cta: blueprint.cta,
    };
  });

  // Calcula a próxima ação global recomendada
  let proximaAcaoGlobal = "";
  let resumoContinuidade = "";

  if (isOptedOutOrRefused) {
    proximaAcaoGlobal = "Nenhuma ação comercial: respeitar opt-out/recusa registrado. Proibido enviar qualquer mensagem.";
    resumoContinuidade = "Sequência encerrada imediatamente para evitar insistência comercial indesejada.";
  } else if (isDiscardedWithoutOptOut) {
    proximaAcaoGlobal = "Lead arquivado por falta de aderência comercial. Priorize as oportunidades ativas da missão.";
    resumoContinuidade = "Lead fora do perfil prioritário no momento.";
  } else if (historyStage === "reuniao_marcada") {
    proximaAcaoGlobal = `Confirmar conversa agendada com ${companyName} e revisar as perguntas do Dossiê Comercial.`;
    resumoContinuidade = "Plano adaptado para preparação de reunião e proposta.";
  } else if (historyStage === "empresa_interessada") {
    proximaAcaoGlobal = `Enviar proposta enxuta ou alinhar conversa rápida de 15 min com ${companyName}.`;
    resumoContinuidade = "Plano priorizado para conversão de lead interessado.";
  } else if (historyStage === "empresa_respondeu") {
    proximaAcaoGlobal = `Responder ao retorno da ${companyName} com a pergunta de diagnóstico do Dia ${firstUncompletedDay || 2}.`;
    resumoContinuidade = "Mensagens de primeiro contato desativadas porque a empresa já respondeu.";
  } else if (firstUncompletedDay !== null) {
    const activeDayObj = adaptedDays.find((d) => d.dia === firstUncompletedDay);
    proximaAcaoGlobal = `Executar Dia ${firstUncompletedDay}: ${activeDayObj?.acao_sugerida || "Próxima etapa do plano"}`;
    resumoContinuidade =
      completedSet.size === 0
        ? "Nenhuma etapa concluída ainda. Comece pelo Dia 1 sem pular etapas."
        : `${completedSet.size} de 7 etapas concluídas. Retome exatamente do Dia ${firstUncompletedDay}.`;
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
  };
}
