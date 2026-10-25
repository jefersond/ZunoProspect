import type { LeadProspeccao } from "@/types/lead";
import {
  calculateLeadCompatibilityScore,
  type CompatibilityExplanation,
} from "./leadCompatibilityScore";
import {
  buildLeadCommercialDossier,
  type LeadCommercialDossier,
} from "./leadCommercialDossier";
import {
  buildIntelligentSevenDayPlan,
  loadSevenDayExecutionState,
  type IntelligentSevenDayPlanResult,
  type LeadHistoryStage,
} from "./intelligentSevenDayPlan";
import {
  checkSdrDuplicateApproach,
  generateAllSdrStyleVariations,
  type SdrApproachStyle,
  type SdrDuplicateCheckResult,
} from "./sdrProspectingService";

export interface ZunoCommercialMission {
  missionId: string;
  userId: string;
  title: string;
  serviceOffered: string;
  targetCity: string;
  targetState: string;
  targetSegment: string;
  commercialObjective: string;
  minCompatibilityScore: number; // 0 a 100 (padrão 70)
  preferredStyle: SdrApproachStyle;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluatedMissionLead {
  lead: LeadProspeccao;
  compatibility: CompatibilityExplanation;
  dossier: LeadCommercialDossier;
  intelligentPlan: IntelligentSevenDayPlanResult;
  duplicateCheck: SdrDuplicateCheckResult;
  isAboveMinScore: boolean;
}

export interface MissionProgressSummary {
  totalLeadsMapped: number;
  prioritizedCount: number;
  belowThresholdCount: number;
  approachesPreparedCount: number;
  contactsInitiatedCount: number;
  repliedCount: number;
  interestedCount: number;
  meetingsScheduledCount: number;
  optedOutCount: number;
}

export interface MissionEvaluationResult {
  mission: ZunoCommercialMission;
  allEvaluated: EvaluatedMissionLead[];
  prioritizedOpportunities: EvaluatedMissionLead[];
  belowThresholdLeads: EvaluatedMissionLead[];
  optedOutLeads: EvaluatedMissionLead[];
  progress: MissionProgressSummary;
  nextRecommendedAction: {
    headline: string;
    detail: string;
    targetLeadId: string | null;
    targetLeadName: string | null;
    recommendedDay: number | null;
  };
}

const MISSION_STORAGE_PREFIX = "zuno_next_active_mission_";
const missionMemoryMap = new Map<string, string>();

const missionMemoryFallback: Pick<Storage, "getItem" | "setItem"> = {
  getItem: (key: string) => (missionMemoryMap.has(key) ? missionMemoryMap.get(key)! : null),
  setItem: (key: string, value: string) => {
    missionMemoryMap.set(key, value);
  },
};

export function clearMissionMemoryStorage(): void {
  missionMemoryMap.clear();
}

function getSafeStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore
  }
  return missionMemoryFallback;
}

/**
 * Cria a missão padrão inicial baseada no cenário oficial de demonstração:
 * "Ofereço gestão de tráfego e quero encontrar clínicas odontológicas em Vila Velha/ES"
 */
export function createDefaultVilaVelhaMission(userId = "admin_default"): ZunoCommercialMission {
  const now = new Date().toISOString();
  return {
    missionId: `mission_vv_odonto_${userId}`,
    userId,
    title: "Gestão de Tráfego • Clínicas Odontológicas em Vila Velha/ES",
    serviceOffered: "Gestão de Tráfego para Clínicas",
    targetCity: "Vila Velha",
    targetState: "ES",
    targetSegment: "Clínicas Odontológicas",
    commercialObjective:
      "Encontrar clínicas com canais verificados, iniciar abordagem consultiva pelo WhatsApp e qualificar a demanda com transparência.",
    minCompatibilityScore: 70,
    preferredStyle: "consultivo",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Carrega a missão comercial ativa isolada por userId.
 */
export function loadActiveMissionForUser(userId?: string | null): ZunoCommercialMission {
  const safeUser = (userId || "admin_default").trim();
  const storage = getSafeStorage();

  if (storage) {
    try {
      const raw = storage.getItem(`${MISSION_STORAGE_PREFIX}${safeUser}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ZunoCommercialMission;
        return {
          ...parsed,
          userId: safeUser,
          minCompatibilityScore:
            typeof parsed.minCompatibilityScore === "number"
              ? Math.min(100, Math.max(0, parsed.minCompatibilityScore))
              : 70,
        };
      }
    } catch {
      // ignore parse errors
    }
  }

  return createDefaultVilaVelhaMission(safeUser);
}

/**
 * Salva a missão comercial ativa isolada por userId.
 */
export function saveActiveMissionForUser(
  userId: string | null | undefined,
  missionUpdate: Partial<ZunoCommercialMission>
): ZunoCommercialMission {
  const safeUser = (userId || "admin_default").trim();
  const current = loadActiveMissionForUser(safeUser);
  const clampedScore =
    typeof missionUpdate.minCompatibilityScore === "number"
      ? Math.min(100, Math.max(0, Math.round(missionUpdate.minCompatibilityScore)))
      : current.minCompatibilityScore;

  const updated: ZunoCommercialMission = {
    ...current,
    ...missionUpdate,
    userId: safeUser,
    minCompatibilityScore: clampedScore,
    title:
      missionUpdate.title ||
      `${missionUpdate.serviceOffered || current.serviceOffered} • ${
        missionUpdate.targetSegment || current.targetSegment
      } em ${missionUpdate.targetCity || current.targetCity}/${
        missionUpdate.targetState || current.targetState
      }`,
    updatedAt: new Date().toISOString(),
  };

  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(`${MISSION_STORAGE_PREFIX}${safeUser}`, JSON.stringify(updated));
  }

  return updated;
}

/**
 * Avalia uma lista de leads dentro do contexto da Missão Comercial ativa,
 * calculando Score (0-100), Dossiê Comercial, Plano Inteligente de 7 Dias e Próxima Melhor Ação.
 */
export function evaluateMissionQueue(
  mission: ZunoCommercialMission,
  leads: LeadProspeccao[],
  leadStageOverrides: Record<string, LeadHistoryStage> = {}
): MissionEvaluationResult {
  const allEvaluated: EvaluatedMissionLead[] = leads.map((lead) => {
    const compatibility = calculateLeadCompatibilityScore(lead, {
      userServiceName: mission.serviceOffered,
      minScoreThreshold: mission.minCompatibilityScore,
      targetCity: mission.targetCity,
      targetNiche: mission.targetSegment,
    });

    const dossier = buildLeadCommercialDossier(lead, {
      userServiceName: mission.serviceOffered,
      commercialObjective: mission.commercialObjective,
      minScoreThreshold: mission.minCompatibilityScore,
    });

    const executionState = loadSevenDayExecutionState(mission.userId, lead.id, lead);
    const overrideStage = leadStageOverrides[lead.id];

    const intelligentPlan = buildIntelligentSevenDayPlan({
      lead,
      userServiceName: mission.serviceOffered,
      preferredStyle: mission.preferredStyle,
      existingPlan: lead.plano_prospecao_7dias,
      executionState,
      overrideHistoryStage: overrideStage,
    });

    const duplicateCheck = checkSdrDuplicateApproach(lead);

    return {
      lead,
      compatibility,
      dossier,
      intelligentPlan,
      duplicateCheck,
      isAboveMinScore: compatibility.score >= mission.minCompatibilityScore,
    };
  });

  // Ordena por maior score de compatibilidade
  const sorted = [...allEvaluated].sort((a, b) => b.compatibility.score - a.compatibility.score);

  const optedOutLeads = sorted.filter((item) => item.intelligentPlan.isOptedOutOrRefused);
  const prioritizedOpportunities = sorted.filter(
    (item) => item.isAboveMinScore && !item.intelligentPlan.isOptedOutOrRefused
  );
  const belowThresholdLeads = sorted.filter(
    (item) => !item.isAboveMinScore && !item.intelligentPlan.isOptedOutOrRefused
  );

  // Contadores reais de progresso da missão
  let contactsInitiatedCount = 0;
  let repliedCount = 0;
  let interestedCount = 0;
  let meetingsScheduledCount = 0;

  for (const item of allEvaluated) {
    const st = item.intelligentPlan.historyStage;
    if (st !== "nao_contatado") contactsInitiatedCount++;
    if (st === "empresa_respondeu" || st === "empresa_interessada" || st === "reuniao_marcada") {
      repliedCount++;
    }
    if (st === "empresa_interessada" || st === "reuniao_marcada") {
      interestedCount++;
    }
    if (st === "reuniao_marcada") {
      meetingsScheduledCount++;
    }
  }

  const progress: MissionProgressSummary = {
    totalLeadsMapped: allEvaluated.length,
    prioritizedCount: prioritizedOpportunities.length,
    belowThresholdCount: belowThresholdLeads.length,
    approachesPreparedCount: prioritizedOpportunities.length,
    contactsInitiatedCount,
    repliedCount,
    interestedCount,
    meetingsScheduledCount,
    optedOutCount: optedOutLeads.length,
  };

  // Determina a Próxima Melhor Ação da Missão (prioriza quem respondeu/demonstrou interesse, depois o maior score ainda não contatado)
  const urgentReplyLead =
    prioritizedOpportunities.find((i) => i.intelligentPlan.historyStage === "empresa_interessada") ||
    prioritizedOpportunities.find((i) => i.intelligentPlan.historyStage === "empresa_respondeu") ||
    prioritizedOpportunities.find((i) => i.intelligentPlan.historyStage === "nao_contatado") ||
    prioritizedOpportunities[0] ||
    null;

  const nextRecommendedAction = urgentReplyLead
    ? {
        headline: `Focar em ${urgentReplyLead.lead.nome} (${urgentReplyLead.compatibility.score}/100)`,
        detail: urgentReplyLead.intelligentPlan.proximaAcaoGlobal,
        targetLeadId: urgentReplyLead.lead.id,
        targetLeadName: urgentReplyLead.lead.nome,
        recommendedDay: urgentReplyLead.intelligentPlan.currentRecommendedDay,
      }
    : {
        headline: "Ajustar filtro de compatibilidade ou buscar novas empresas na praça",
        detail: `Nenhuma oportunidade ativa acima de ${mission.minCompatibilityScore}/100 no momento.`,
        targetLeadId: null,
        targetLeadName: null,
        recommendedDay: null,
      };

  return {
    mission,
    allEvaluated: sorted,
    prioritizedOpportunities,
    belowThresholdLeads,
    optedOutLeads,
    progress,
    nextRecommendedAction,
  };
}

/**
 * Conjunto de leads demonstrativos realistas (identificados com is_simulated) para o cenário obrigatório:
 * "Ofereço gestão de tráfego e quero encontrar clínicas odontológicas em Vila Velha/ES"
 */
export function getVilaVelhaDentalMissionDemoLeads(): LeadProspeccao[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-vv-odonto-1",
      placeId: "place_vv_odonto_1",
      nome: "Clínica Odontológica Praia da Costa Prime (Simulação Lab)",
      telefone: "(27) 99876-5432",
      whatsapp_number: "27998765432",
      whatsapp_link: "https://wa.me/5527998765432",
      email: "contato@odontopraiadacostaprime.com.br",
      website: "https://www.odontopraiadacostaprime.com.br",
      instagram_url: "https://instagram.com/odontopraiadacostaprime",
      instagram_context: null,
      endereco: "Av. Champagnat, 620 - Praia da Costa, Vila Velha - ES",
      cidade: "Vila Velha",
      nicho: "Clínica Odontológica",
      foco: "Tráfego",
      proximidadeAtiva: false,
      raioKm: null,
      sinais: {
        has_whatsapp_on_site: true,
        has_meta_pixel: true,
        has_gtag: true,
        has_gtm: false,
      },
      diagnostico_bullets: [],
      probabilidade_conversao: 95,
      plano_prospecao_7dias: [],
      rating: 4.9,
      total_reviews: 84,
      status: "novo",
      created_at: now,
      ai_analise_gerada_em: now,
      salvo: true,
      notas: null,
      cnpj: null,
      razao_social: null,
      nome_responsavel: null,
      cnpj_telefone: null,
      cnpj_email: null,
      situacao_cadastral: "ATIVA",
      porte_empresa: null,
      cnae_principal: null,
      custom_fields: {
        is_simulated: "true",
        simulation_warning: "SIMULAÇÃO — DADOS FICTÍCIOS, NÃO UTILIZAR PARA CONTATO.",
      },
    },
    {
      id: "demo-vv-odonto-2",
      placeId: "place_vv_odonto_2",
      nome: "Centro Integrado Sorriso Itapuã (Simulação Lab)",
      telefone: "(27) 99711-2233",
      whatsapp_number: "27997112233",
      whatsapp_link: "https://wa.me/5527997112233",
      email: null,
      website: "https://www.sorrisoitapua.com.br",
      instagram_url: null,
      instagram_context: null,
      endereco: "Rua Jair de Andrade, 140 - Itapuã, Vila Velha - ES",
      cidade: "Vila Velha",
      nicho: "Clínica Odontológica e Implantes",
      foco: "Tráfego",
      proximidadeAtiva: false,
      raioKm: null,
      sinais: {
        has_whatsapp_on_site: true,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
      diagnostico_bullets: [],
      probabilidade_conversao: 85,
      plano_prospecao_7dias: [],
      rating: 4.8,
      total_reviews: 32,
      status: "respondeu",
      created_at: now,
      ai_analise_gerada_em: now,
      salvo: true,
      notas: "[SDR WhatsApp - 2026-10-24] Status: respondeu - Recepção perguntou como funciona a captação para implantes",
      cnpj: null,
      razao_social: null,
      nome_responsavel: null,
      cnpj_telefone: null,
      cnpj_email: null,
      situacao_cadastral: "ATIVA",
      porte_empresa: null,
      cnae_principal: null,
      custom_fields: {
        is_simulated: "true",
        simulation_warning: "SIMULAÇÃO — DADOS FICTÍCIOS, NÃO UTILIZAR PARA CONTATO.",
      },
    },
    {
      id: "demo-vv-odonto-3",
      placeId: "place_vv_odonto_3",
      nome: "OdontoVila Consultórios Associados (Simulação Lab)",
      telefone: "(27) 3329-4455",
      whatsapp_number: null,
      whatsapp_link: null,
      email: null,
      website: null,
      instagram_url: null,
      instagram_context: null,
      endereco: "Centro, Vila Velha - ES",
      cidade: "Vila Velha",
      nicho: "Consultório Odontológico",
      foco: "Tráfego",
      proximidadeAtiva: false,
      raioKm: null,
      sinais: {
        has_whatsapp_on_site: false,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
      diagnostico_bullets: [],
      probabilidade_conversao: 45,
      plano_prospecao_7dias: [],
      rating: 4.5,
      total_reviews: 6,
      status: "novo",
      created_at: now,
      ai_analise_gerada_em: now,
      salvo: false,
      notas: null,
      cnpj: null,
      razao_social: null,
      nome_responsavel: null,
      cnpj_telefone: null,
      cnpj_email: null,
      situacao_cadastral: "ATIVA",
      porte_empresa: null,
      cnae_principal: null,
      custom_fields: {
        is_simulated: "true",
        simulation_warning: "SIMULAÇÃO — DADOS FICTÍCIOS, NÃO UTILIZAR PARA CONTATO.",
      },
    },
    {
      id: "demo-vv-odonto-4",
      placeId: "place_vv_odonto_4",
      nome: "Studio Dental Gaivotas (Simulação Lab - Opt-out)",
      telefone: "(27) 99654-3210",
      whatsapp_number: "27996543210",
      whatsapp_link: "https://wa.me/5527996543210",
      email: null,
      website: "https://www.studiodentalgaivotas.com.br",
      instagram_url: null,
      instagram_context: null,
      endereco: "Parque das Gaivotas, Vila Velha - ES",
      cidade: "Vila Velha",
      nicho: "Clínica Odontológica",
      foco: "Tráfego",
      proximidadeAtiva: false,
      raioKm: null,
      sinais: {
        has_whatsapp_on_site: true,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
      diagnostico_bullets: [],
      probabilidade_conversao: 80,
      plano_prospecao_7dias: [],
      rating: 4.7,
      total_reviews: 21,
      status: "descartado",
      created_at: now,
      ai_analise_gerada_em: now,
      salvo: false,
      notas: "[SDR WhatsApp - 2026-10-24] Status: descartado - Pediu para não receber novos contatos",
      cnpj: null,
      razao_social: null,
      nome_responsavel: null,
      cnpj_telefone: null,
      cnpj_email: null,
      situacao_cadastral: "ATIVA",
      porte_empresa: null,
      cnae_principal: null,
      custom_fields: {
        is_simulated: "true",
        simulation_warning: "SIMULAÇÃO — DADOS FICTÍCIOS, NÃO UTILIZAR PARA CONTATO.",
      },
    },
  ];
}

/**
 * Executa a simulação completa e auditável do cenário obrigatório da Seção 14:
 * "Ofereço gestão de tráfego e quero encontrar clínicas odontológicas em Vila Velha/ES"
 */
export function runVilaVelhaMissionDemonstration() {
  const mission = createDefaultVilaVelhaMission("admin_demo");
  const demoLeads = getVilaVelhaDentalMissionDemoLeads();
  const queueEvaluation = evaluateMissionQueue(mission, demoLeads);

  const primaryLead = demoLeads[0];
  const sdrThreeStyles = generateAllSdrStyleVariations({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
  });

  // Simula todas as 5 transições exigidas na Seção 14 para a clínica principal
  const stageNoContact = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    overrideHistoryStage: "nao_contatado",
  });

  const stageNoReply = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    executionState: { completedDays: [1] },
    overrideHistoryStage: "contato_iniciado_sem_resposta",
  });

  const stageReplied = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    executionState: { completedDays: [1] },
    overrideHistoryStage: "empresa_respondeu",
  });

  const stageInterested = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    executionState: { completedDays: [1, 2] },
    overrideHistoryStage: "empresa_interessada",
  });

  const stageRefused = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    executionState: { completedDays: [1] },
    overrideHistoryStage: "recusa_ou_optout",
  });

  // Retomada no dia seguinte (Dia 1 concluído ontem -> retoma no Dia 2; se Dia 2 não foi feito, permanece no Dia 2)
  const nextDayResumption = buildIntelligentSevenDayPlan({
    lead: primaryLead,
    userServiceName: mission.serviceOffered,
    executionState: {
      userId: "admin_demo",
      leadId: primaryLead.id,
      completedDays: [1],
      currentHistoryStage: "contato_iniciado_sem_resposta",
      lastUpdatedIso: new Date(Date.now() - 86400000).toISOString(),
      customDayNotes: {},
    },
  });

  return {
    mission,
    queueEvaluation,
    primaryLeadDossier: queueEvaluation.prioritizedOpportunities[0]?.dossier,
    sdrThreeStyles,
    transitions: {
      naoContatado: stageNoContact,
      semResposta: stageNoReply,
      respondeu: stageReplied,
      interessado: stageInterested,
      recusouOptOut: stageRefused,
      retomadaDiaSeguinte: nextDayResumption,
    },
  };
}
