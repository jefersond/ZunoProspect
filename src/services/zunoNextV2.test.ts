import { describe, it, expect, beforeEach } from "vitest";
import {
  canAccessZunoNextLab,
  validateLabAccessSecurity,
  isZunoNextLabActiveForUser,
  setZunoNextLabEnabled,
  triggerLabKillSwitch,
  ZUNO_NEXT_ROADMAP_20,
  ZUNO_COPY_REVIEW_COMPARISON,
} from "./zunoNextLab";
import {
  calculateLeadCompatibilityScore,
} from "./leadCompatibilityScore";
import {
  buildLeadCommercialDossier,
} from "./leadCommercialDossier";
import {
  buildIntelligentSevenDayPlan,
  loadSevenDayExecutionState,
  toggleSevenDayStepCompletion,
} from "./intelligentSevenDayPlan";
import {
  generateSdrFirstApproachMessage,
  generateAllSdrStyleVariations,
  checkSdrDuplicateApproach,
  auditMessageNaturalness,
  sanitizeBrazilianPhoneNumber,
} from "./sdrProspectingService";
import {
  createDefaultVilaVelhaMission,
  saveActiveMissionForUser,
  loadActiveMissionForUser,
  evaluateMissionQueue,
  getVilaVelhaDentalMissionDemoLeads,
  runVilaVelhaMissionDemonstration,
} from "./zunoMissionService";
import { PLANS } from "@/config/plans";

describe("ZUNO NEXT V2 — Suite Completa dos 20 Cenários Obrigatórios", () => {
  beforeEach(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  // 1. Acesso Admin permitido
  it("1. deve permitir acesso ao Laboratório Zuno para Admin autenticado", () => {
    const adminUser = { id: "admin-1", email: "jeferson.zanotell@gmail.com" };
    const adminProfile = { id: "admin-1", email: "jeferson.zanotell@gmail.com", role: "admin", is_admin: true };

    expect(canAccessZunoNextLab(adminUser, adminProfile)).toBe(true);
    expect(isZunoNextLabActiveForUser(adminUser, adminProfile)).toBe(true);

    const audit = validateLabAccessSecurity({ user: adminUser, profile: adminProfile });
    expect(audit.allowed).toBe(true);
    expect(audit.isAdminVerified).toBe(true);
  });

  // 2. Acesso de usuário comum bloqueado
  it("2. deve bloquear acesso ao Laboratório Zuno para assinante comum", () => {
    const regularUser = { id: "user-123", email: "assinante@agencia.com.br" };
    const regularProfile = { id: "user-123", email: "assinante@agencia.com.br", role: "user", is_admin: false };

    expect(canAccessZunoNextLab(regularUser, regularProfile)).toBe(false);
    expect(isZunoNextLabActiveForUser(regularUser, regularProfile)).toBe(false);
  });

  // 3. Acesso anônimo bloqueado
  it("3. deve bloquear acesso anônimo sem sessão autenticada", () => {
    expect(canAccessZunoNextLab(null, null)).toBe(false);
    expect(canAccessZunoNextLab(undefined, undefined)).toBe(false);
    expect(isZunoNextLabActiveForUser(null, null)).toBe(false);
  });

  // 4. Tentativa de bypass por URL (?admin=true) bloqueada
  it("4. deve detectar e bloquear tentativa de bypass por parâmetro de URL (?admin=true ou ?lab=true)", () => {
    const regularUser = { id: "user-123", email: "assinante@agencia.com.br" };
    const regularProfile = { id: "user-123", email: "assinante@agencia.com.br", role: "user", is_admin: false };

    const bypassAudit = validateLabAccessSecurity({
      user: regularUser,
      profile: regularProfile,
      urlSearch: "?admin=true&lab=true&is_admin=true",
    });

    expect(bypassAudit.allowed).toBe(false);
    expect(bypassAudit.isAdminVerified).toBe(false);
    expect(bypassAudit.attemptedUrlBypassDetected).toBe(true);
    expect(bypassAudit.reason).toContain("parâmetros de URL");
  });

  // 5. Isolamento multiusuário e Kill-Switch
  it("5. deve garantir isolamento multiusuário entre missões/progresso e funcionamento do Kill-Switch", () => {
    saveActiveMissionForUser("user-A", { serviceOffered: "Criação de Sites", minCompatibilityScore: 80 });
    saveActiveMissionForUser("user-B", { serviceOffered: "Social Media", minCompatibilityScore: 60 });

    const missionA = loadActiveMissionForUser("user-A");
    const missionB = loadActiveMissionForUser("user-B");

    expect(missionA.serviceOffered).toBe("Criação de Sites");
    expect(missionA.minCompatibilityScore).toBe(80);
    expect(missionB.serviceOffered).toBe("Social Media");
    expect(missionB.minCompatibilityScore).toBe(60);

    // Progresso dos 7 dias isolado por usuário
    toggleSevenDayStepCompletion({ userId: "user-A", leadId: "lead-1", dayNumber: 1, completed: true });
    expect(loadSevenDayExecutionState("user-A", "lead-1").completedDays).toEqual([1]);
    expect(loadSevenDayExecutionState("user-B", "lead-1").completedDays).toEqual([]);

    // Kill-switch desativa imediatamente a feature flag do Admin
    const adminUser = { id: "admin-1", email: "jeferson.zanotell@gmail.com" };
    triggerLabKillSwitch("admin-1");
    expect(isZunoNextLabActiveForUser(adminUser, { is_admin: true })).toBe(false);
    setZunoNextLabEnabled("admin-1", true);
    expect(isZunoNextLabActiveForUser(adminUser, { is_admin: true })).toBe(true);
  });

  // 6. Preservação dos 7 dias existentes
  it("6. deve preservar exatamente os 7 dias do plano de prospecção (Dias 1 a 7)", () => {
    const demoLeads = getVilaVelhaDentalMissionDemoLeads();
    const plan = buildIntelligentSevenDayPlan({
      lead: demoLeads[0],
      userServiceName: "Gestão de Tráfego",
    });

    expect(plan.days).toHaveLength(7);
    expect(plan.days.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  // 7. Evolução correta de cada um dos 7 dias
  it("7. deve apresentar objetivo, ação, explicação da tarefa, dados necessários, critério de conclusão e mensagem natural em todos os 7 dias", () => {
    const demoLeads = getVilaVelhaDentalMissionDemoLeads();
    const plan = buildIntelligentSevenDayPlan({
      lead: demoLeads[0],
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    for (const day of plan.days) {
      expect(day.titulo_dia).toBeTruthy();
      expect(day.objetivo).toBeTruthy();
      expect(day.acao_sugerida).toBeTruthy();
      expect(day.explicacao_tarefa).toBeTruthy();
      expect(Array.isArray(day.informacoes_necessarias)).toBe(true);
      expect(day.informacoes_necessarias!.length).toBeGreaterThan(0);
      expect(day.criterio_conclusao).toBeTruthy();
      expect(day.proxima_acao_sugerida).toBeTruthy();
      expect(day.mensagem).toBeTruthy();
      expect(day.cta).toBeTruthy();

      const audit = auditMessageNaturalness(day.mensagem);
      expect(audit.isNatural).toBe(true);
      expect(audit.violations).toEqual([]);
    }
  });

  // 8. Adaptação das mensagens quando o lead já respondeu
  it("8. deve adaptar o plano quando a empresa respondeu, sem sugerir mensagem fria de primeiro contato", () => {
    const demoLeads = getVilaVelhaDentalMissionDemoLeads();
    const repliedLead = { ...demoLeads[0], status: "respondeu" };

    const plan = buildIntelligentSevenDayPlan({
      lead: repliedLead,
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    expect(plan.historyStage).toBe("empresa_respondeu");
    const activeDay = plan.days.find((d) => d.dia === plan.currentRecommendedDay);
    expect(activeDay).toBeDefined();
    expect(activeDay?.status_dia).toBe("adaptado");
    expect(activeDay?.mensagem).toContain("Obrigado pelo retorno");
    expect(activeDay?.adaptation_reason).toContain("já respondeu");
  });

  // 9. Interrupção de follow-up quando houve recusa ou opt-out
  it("9. deve interromper imediatamente qualquer sugestão de insistência quando houver recusa ou opt-out", () => {
    const demoLeads = getVilaVelhaDentalMissionDemoLeads();
    const optOutLead = demoLeads[3]; // Studio Dental Gaivotas com status descartado / opt-out

    const plan = buildIntelligentSevenDayPlan({
      lead: optOutLead,
      userServiceName: "Gestão de Tráfego",
    });

    expect(plan.isOptedOutOrRefused).toBe(true);
    expect(plan.currentRecommendedDay).toBeNull();
    expect(plan.days.every((d) => d.status_dia === "bloqueado_optout")).toBe(true);
    expect(plan.days[0].mensagem).toContain("CONTATO INTERROMPIDO");
  });

  // 10. Criação de missão comercial
  it("10. deve criar e avaliar uma Missão Comercial completa (Vila Velha/ES)", () => {
    const mission = createDefaultVilaVelhaMission("admin-test");
    const leads = getVilaVelhaDentalMissionDemoLeads();
    const evalResult = evaluateMissionQueue(mission, leads);

    expect(evalResult.mission.targetCity).toBe("Vila Velha");
    expect(evalResult.mission.targetSegment).toBe("Clínicas Odontológicas");
    expect(evalResult.progress.totalLeadsMapped).toBe(4);
    expect(evalResult.prioritizedOpportunities.length).toBeGreaterThanOrEqual(2);
    expect(evalResult.nextRecommendedAction.targetLeadId).toBeTruthy();
  });

  // 11. Cálculo do score de compatibilidade 0–100
  it("11. deve calcular o Índice de Compatibilidade Comercial (0 a 100) explicável sem apresentá-lo como probabilidade de fechamento", () => {
    const leads = getVilaVelhaDentalMissionDemoLeads();
    const scoreHigh = calculateLeadCompatibilityScore(leads[0], {
      userServiceName: "Gestão de Tráfego",
    });

    expect(scoreHigh.score).toBeGreaterThanOrEqual(80);
    expect(scoreHigh.score).toBeLessThanOrEqual(100);
    expect(scoreHigh.motivos.length).toBeGreaterThan(0);
    expect(scoreHigh.dadosUtilizados.length).toBeGreaterThan(0);
    expect(scoreHigh.dadosNaoVerificados.length).toBeGreaterThan(0);
    expect(scoreHigh.resumoExplicativo).toContain("Não representa probabilidade de fechamento");
  });

  // 12. Edição do filtro mínimo de compatibilidade
  it("12. deve permitir editar a nota mínima de compatibilidade (ex: 70 para 90 ou 40) e filtrar as oportunidades prioritárias", () => {
    const leads = getVilaVelhaDentalMissionDemoLeads();
    const mission70 = createDefaultVilaVelhaMission("admin-test");
    const eval70 = evaluateMissionQueue({ ...mission70, minCompatibilityScore: 70 }, leads);
    const eval95 = evaluateMissionQueue({ ...mission70, minCompatibilityScore: 95 }, leads);
    const eval40 = evaluateMissionQueue({ ...mission70, minCompatibilityScore: 40 }, leads);

    expect(eval40.prioritizedOpportunities.length).toBeGreaterThanOrEqual(
      eval70.prioritizedOpportunities.length
    );
    expect(eval70.prioritizedOpportunities.length).toBeGreaterThanOrEqual(
      eval95.prioritizedOpportunities.length
    );
  });

  // 13. Separação entre fatos e hipóteses no dossiê
  it("13. deve separar rigorosamente 'O QUE SABEMOS' (fatos verificados) de 'POSSÍVEIS ÂNGULOS COMERCIAIS' (hipóteses) no Dossiê", () => {
    const leads = getVilaVelhaDentalMissionDemoLeads();
    const dossier = buildLeadCommercialDossier(leads[0], {
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    expect(dossier.oQueSabemos.length).toBeGreaterThanOrEqual(5);
    expect(dossier.possiveisAngulosComerciais.length).toBeGreaterThanOrEqual(2);
    expect(dossier.porQueValeAnalisar.headline).toContain("Vila Velha");
    expect(dossier.limitacoesAnalise.length).toBeGreaterThan(0);

    // Garante que cada ângulo possui hipótese e pergunta investigativa
    for (const angle of dossier.possiveisAngulosComerciais) {
      expect(angle.hypothesis).toBeTruthy();
      expect(angle.investigativeQuestion).toContain("?");
    }
  });

  // 14. Geração dos três estilos de mensagem SDR
  it("14. deve gerar os 3 estilos distintos de mensagem SDR (Consultivo, Direto e Exemplo Prático)", () => {
    const leads = getVilaVelhaDentalMissionDemoLeads();
    const variations = generateAllSdrStyleVariations({
      lead: leads[0],
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    expect(variations.consultivo.text).not.toBe(variations.direto.text);
    expect(variations.consultivo.text).not.toBe(variations.exemplo_pratico.text);
    expect(variations.direto.text).not.toBe(variations.exemplo_pratico.text);

    expect(auditMessageNaturalness(variations.consultivo.text).isNatural).toBe(true);
    expect(auditMessageNaturalness(variations.direto.text).isNatural).toBe(true);
    expect(auditMessageNaturalness(variations.exemplo_pratico.text).isNatural).toBe(true);
  });

  // 15. Adaptação das mensagens para diferentes serviços oferecidos
  it("15. deve mudar o argumento comercial real conforme o serviço oferecido (Sites, Tráfego, Social Media, Clínicas)", () => {
    const lead = getVilaVelhaDentalMissionDemoLeads()[0];

    const msgSites = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "Criação de Sites e Landing Pages",
      style: "consultivo",
    });
    const msgTrafego = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "Gestão de Tráfego Pago",
      style: "consultivo",
    });
    const msgSocial = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "Social Media e Conteúdo para Instagram",
      style: "consultivo",
    });

    expect(msgSites.serviceCategory).toBe("criacao_sites");
    expect(msgTrafego.serviceCategory).toBe("clinicas");
    expect(msgSocial.serviceCategory).toBe("social_media");

    expect(msgSites.text).toContain("apresentação dos serviços no site");
    expect(msgTrafego.text).toContain("atraírem pacientes");
    expect(msgSocial.text).toContain("posicionamento e os conteúdos");
  });

  // 16. Prevenção de abordagem duplicada
  it("16. deve detectar e alertar quando um lead já possui abordagem SDR registrada", () => {
    const freshLead = { id: "1", nome: "Empresa Nova", status: "novo", notas: null };
    const approachedLead = {
      id: "2",
      nome: "Empresa Já Abordada",
      status: "em_contato",
      notas: "[SDR WhatsApp - 2026-10-24] Status: contato_realizado",
    };

    expect(checkSdrDuplicateApproach(freshLead).isDuplicate).toBe(false);
    expect(checkSdrDuplicateApproach(approachedLead).isDuplicate).toBe(true);
  });

  // 17. Edição manual da mensagem e detector de clichês robóticos
  it("17. deve reprovar mensagens com clichês robóticos banidos e aprovar mensagens humanas editadas", () => {
    const roboticCheck = auditMessageNaturalness(
      "Olá! Identificamos oportunidades de melhoria na sua presença digital para alavancar suas vendas exponencialmente."
    );
    expect(roboticCheck.isNatural).toBe(false);
    expect(roboticCheck.violations.length).toBeGreaterThanOrEqual(2);

    const naturalEdited = auditMessageNaturalness(
      "Oi, pessoal da Clínica Praia da Costa! Vi o site de vocês em Vila Velha e preparei uma ideia prática de 1 minuto sobre captação local de pacientes. Posso enviar por aqui?"
    );
    expect(naturalEdited.isNatural).toBe(true);
    expect(naturalEdited.violations).toEqual([]);
  });

  // 18. Geração correta do link wa.me
  it("18. deve sanitizar o telefone brasileiro e gerar o link oficial wa.me com texto codificado", () => {
    const phone = sanitizeBrazilianPhoneNumber("(27) 99876-5432");
    expect(phone.isValid).toBe(true);
    expect(phone.isCellPhone).toBe(true);
    expect(phone.cleanNumber).toBe("5527998765432");

    const generated = generateSdrFirstApproachMessage({
      lead: getVilaVelhaDentalMissionDemoLeads()[0],
      userServiceName: "Gestão de Tráfego",
    });
    expect(generated.whatsappUrl).toContain("https://wa.me/5527998765432?text=");
  });

  // 19. Persistência do progresso dos 7 dias e retomada no dia seguinte sem avanço artificial
  it("19. deve persistir o progresso dos 7 dias e retomar no dia seguinte sem avançar artificialmente etapas não concluídas", () => {
    const lead = getVilaVelhaDentalMissionDemoLeads()[0];

    // Usuário conclui apenas o Dia 1
    const stateAfterDay1 = toggleSevenDayStepCompletion({
      userId: "admin-retomada",
      leadId: lead.id,
      dayNumber: 1,
      completed: true,
      lead,
    });

    const planNextDay = buildIntelligentSevenDayPlan({
      lead,
      userServiceName: "Gestão de Tráfego",
      executionState: stateAfterDay1,
    });

    // Como o Dia 2 ainda não foi concluído, a etapa recomendada deve ser o Dia 2 (sem avançar para o Dia 3)
    expect(planNextDay.currentRecommendedDay).toBe(2);
    expect(planNextDay.days[0].status_dia).toBe("concluido");
    expect(planNextDay.days[1].status_dia).toBe("disponivel");

    // Executa também a demonstração completa de Vila Velha/ES
    const fullDemo = runVilaVelhaMissionDemonstration();
    expect(fullDemo.transitions.naoContatado.currentRecommendedDay).toBe(1);
    expect(fullDemo.transitions.retomadaDiaSeguinte.currentRecommendedDay).toBe(2);
    expect(fullDemo.transitions.respondeu.historyStage).toBe("empresa_respondeu");
    expect(fullDemo.transitions.interessado.historyStage).toBe("empresa_interessada");
    expect(fullDemo.transitions.recusouOptOut.isOptedOutOrRefused).toBe(true);
  });

  // 20. Preservação do checkout, preços e dos planos Starter, Pro e Agency
  it("20. deve preservar integralmente os planos Starter (R$ 47), Pro (R$ 97), Agency (R$ 247) e as regras de trial", () => {
    expect(PLANS.starter.monthlyPrice).toBe(47);
    expect(PLANS.starter.leadsLimit).toBe(300);
    expect(PLANS.starter.aiLimit).toBe(30);

    expect(PLANS.pro.monthlyPrice).toBe(97);
    expect(PLANS.pro.leadsLimit).toBe(800);
    expect(PLANS.pro.aiLimit).toBe(100);

    expect(PLANS.agency.monthlyPrice).toBe(247);
    expect(PLANS.agency.leadsLimit).toBe(2000);
    expect(PLANS.agency.aiLimit).toBe(300);

    expect(ZUNO_NEXT_ROADMAP_20).toHaveLength(20);
    expect(ZUNO_COPY_REVIEW_COMPARISON.length).toBeGreaterThanOrEqual(8);
  });

  // 21. Bloqueio por permissões forjadas em perfil
  it("21. deve bloquear acesso ao Laboratório se o usuário forjar perfil com role: 'admin' ou is_admin: true mas não tiver e-mail autorizado", () => {
    const forgedUser = { id: "attacker-1", email: "attacker@externaldomain.com" };
    const forgedProfile = {
      id: "attacker-1",
      email: "attacker@externaldomain.com",
      role: "admin",
      is_admin: true,
    };

    expect(canAccessZunoNextLab(forgedUser, forgedProfile)).toBe(false);
    expect(isZunoNextLabActiveForUser(forgedUser, forgedProfile)).toBe(false);

    const audit = validateLabAccessSecurity({ user: forgedUser, profile: forgedProfile });
    expect(audit.allowed).toBe(false);
    expect(audit.isAdminVerified).toBe(false);
    expect(audit.reason).toContain("Acesso restrito");
  });

  // 22. Impossibilidade de reversão de opt-out por cache ou simulação
  it("22. deve garantir impossibilidade absoluta de reversão de opt-out por estado salvo em navegador ou simulação", () => {
    const optOutLead = {
      id: "lead-optout-lock",
      nome: "Empresa com Recusa",
      status: "novo",
      notas: "Status: descartado - Pediu para não receber novos contatos",
    };

    // Mesmo que o cache local do navegador diga que o lead concluiu etapas e estava interessado:
    const staleState = {
      userId: "admin-test",
      leadId: optOutLead.id,
      completedDays: [1, 2],
      currentHistoryStage: "empresa_interessada" as const,
      lastUpdatedIso: new Date().toISOString(),
      customDayNotes: {},
    };

    const plan = buildIntelligentSevenDayPlan({
      lead: optOutLead,
      userServiceName: "Gestão de Tráfego",
      executionState: staleState,
    });

    expect(plan.isOptedOutOrRefused).toBe(true);
    expect(plan.historyStage).toBe("recusa_ou_optout");
    expect(plan.currentRecommendedDay).toBeNull();
    expect(plan.proximaAcaoGlobal).toContain("respeitar opt-out");
    expect(plan.days.every((d) => d.status_dia === "bloqueado_optout")).toBe(true);
  });

  // 23. Diferenciação entre sem_resposta, descartado e opt-out
  it("23. deve diferenciar rigorosamente 'sem resposta' (ativo no funil) de 'descartado' e de 'opt-out' (bloqueado)", () => {
    const semRespostaLead = {
      id: "lead-no-reply",
      nome: "Empresa Sem Resposta",
      status: "sem_resposta",
      notas: "[SDR WhatsApp] Status: sem_resposta - aguardando retorno",
    };
    const descartadoLead = {
      id: "lead-discarded",
      nome: "Empresa Fora de Perfil",
      status: "descartado",
      notas: "Empresa fechou as portas",
    };
    const optOutLead = {
      id: "lead-optout-real",
      nome: "Empresa Solicitou Descadasatro",
      status: "novo",
      notas: "Não quero contato por favor",
    };

    const planSemResposta = buildIntelligentSevenDayPlan({ lead: semRespostaLead });
    const planDescartado = buildIntelligentSevenDayPlan({ lead: descartadoLead });
    const planOptOut = buildIntelligentSevenDayPlan({ lead: optOutLead });

    // Sem resposta: estágio de continuidade, pode fazer follow-up sem pressão
    expect(planSemResposta.historyStage).toBe("contato_iniciado_sem_resposta");
    expect(planSemResposta.isOptedOutOrRefused).toBe(false);
    expect(planSemResposta.currentRecommendedDay).toBe(2);

    // Descartado sem opt-out: arquivado sem mensagem de recusa pessoal
    expect(planDescartado.historyStage).toBe("descartado_sem_optout");
    expect(planDescartado.isOptedOutOrRefused).toBe(false);
    expect(planDescartado.currentRecommendedDay).toBeNull();

    // Opt-out: bloqueado com prioridade máxima
    expect(planOptOut.historyStage).toBe("recusa_ou_optout");
    expect(planOptOut.isOptedOutOrRefused).toBe(true);
    expect(planOptOut.currentRecommendedDay).toBeNull();
  });

  // 24. Score contextual comparativo
  it("24. deve garantir que o score de compatibilidade compara dados reais com a missão, sem pontuar apenas por formulário preenchido", () => {
    const leadMismatched = {
      id: "lead-mismatch",
      nome: "Restaurante Sabor Mineiro",
      cidade: "Belo Horizonte",
      nicho: "Restaurante",
      telefone: "3133334444",
    };
    const leadMatched = {
      id: "lead-match",
      nome: "Clínica Odonto Praia",
      cidade: "Vila Velha",
      nicho: "Clínica Odontológica",
      telefone: "27998887766",
      website: "https://odontopraia.com.br",
      endereco: "Av. Champagnat, 500 - Praia da Costa",
      total_reviews: 25,
      rating: 4.9,
    };

    const scoreMismatch = calculateLeadCompatibilityScore(leadMismatched, {
      userServiceName: "Gestão de Tráfego para Clínicas",
      targetCity: "Vila Velha",
      targetNiche: "Clínicas Odontológicas",
    });

    const scoreMatch = calculateLeadCompatibilityScore(leadMatched, {
      userServiceName: "Gestão de Tráfego para Clínicas",
      targetCity: "Vila Velha",
      targetNiche: "Clínicas Odontológicas",
    });

    expect(scoreMismatch.score).toBeLessThan(40);
    expect(scoreMatch.score).toBeGreaterThanOrEqual(70);
    expect(scoreMismatch.motivos.some((m) => m.includes("diferente da cidade-alvo"))).toBe(true);
    expect(scoreMatch.motivos.some((m) => m.includes("coincide com a praça-alvo"))).toBe(true);
  });

  // 25. Modo demonstração seguro
  it("25. deve garantir que todos os leads de demonstração possuem is_simulated e aviso de simulação", () => {
    const demoLeads = getVilaVelhaDentalMissionDemoLeads();
    expect(demoLeads.length).toBe(4);
    for (const lead of demoLeads) {
      expect(lead.custom_fields?.is_simulated).toBe("true");
      expect(lead.custom_fields?.simulation_warning).toContain("SIMULAÇÃO — DADOS FICTÍCIOS");
    }
  });

  // 26. Copys sem promessa automática de vídeo
  it("26. deve gerar mensagens consultivas naturais sem promessa automática de vídeo ou demonstração de 1 minuto por padrão", () => {
    const lead = getVilaVelhaDentalMissionDemoLeads()[0];
    const sdrDefault = generateAllSdrStyleVariations({
      lead,
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    // Sem material confirmado, não promete vídeo de 1 minuto
    expect(sdrDefault.consultivo.text).not.toContain("vídeo de aproximadamente um minuto");
    expect(sdrDefault.direto.text).not.toContain("vídeo de aproximadamente um minuto");
    expect(sdrDefault.exemplo_pratico.text).not.toContain("vídeo de aproximadamente um minuto");

    const planDefault = buildIntelligentSevenDayPlan({
      lead,
      userServiceName: "Gestão de Tráfego para Clínicas",
    });

    for (const day of planDefault.days) {
      expect(day.mensagem).not.toContain("vídeo de 1 minuto");
      expect(day.mensagem).not.toContain("demonstração curta de aproximadamente um minuto");
    }
  });
});
