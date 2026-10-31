import { describe, expect, it } from "vitest";
import { buildNextBestAction, calculateTimeIntervalMetrics } from "./nextBestAction";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

const mockLead = (extra: Partial<LeadProspeccao> = {}): LeadProspeccao =>
  ({
    id: "lead-test-1",
    nome: "Clínica Sorriso Prime",
    nicho: "clínica odontológica",
    cidade: "Curitiba",
    foco: "Automação",
    telefone: "41999887766", // Celular com DDD 41
    status: "novo",
    sinais: { has_whatsapp_on_site: true },
    diagnostico_bullets: ["Observado: clínica em Curitiba"],
    plano_prospecao_7dias: [
      { dia: 1, canal: "whatsapp", mensagem: "Msg 1", status_dia: "pendente" },
      { dia: 2, canal: "nenhum", mensagem: "", status_dia: "pendente" },
      { dia: 3, canal: "email", mensagem: "Msg 3", status_dia: "pendente" },
      { dia: 4, canal: "nenhum", mensagem: "", status_dia: "pendente" },
      { dia: 5, canal: "whatsapp", mensagem: "Msg 5", status_dia: "pendente" },
      { dia: 6, canal: "nenhum", mensagem: "", status_dia: "pendente" },
      { dia: 7, canal: "nenhum", mensagem: "", status_dia: "pendente" },
    ] as PlanoProspeccaoDia[],
    ...extra,
  } as LeadProspeccao);

describe("buildNextBestAction · Motor de Decisão da Próxima Melhor Ação", () => {
  it("Regra 1: Lead novo, sem abordagem registrada -> recomenda primeira abordagem no WhatsApp", () => {
    const lead = mockLead({ status: "novo" });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("primeira_abordagem");
    expect(action.title).toBe("Enviar Primeira Abordagem via WhatsApp");
    expect(action.badgeLabel).toContain("Primeira Abordagem");
    expect(action.reason).toContain("sem histórico de contato registrado");
    expect(action.guidance).toContain("Automação");
    expect(action.primaryAction?.actionType).toBe("execute_sdr");
    expect(action.isColdCadenceActive).toBe(true);
  });

  it("Regra 1 (ausência de dados): Lead novo com telefone fixo sem WhatsApp confirmado -> recomenda confirmar canal", () => {
    const lead = mockLead({
      status: "novo",
      telefone: "4133445566", // fixo
      sinais: { has_whatsapp_on_site: false } as any,
      whatsapp_link: null,
      whatsapp_number: null,
    });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("pesquisa_canal");
    expect(action.title).toBe("Confirmar Canal de Atendimento da Recepção");
    expect(action.badgeLabel).toContain("Telefone Fixo");
    expect(action.guidance).toContain("Ligue no número da recepção");
  });

  it("Regra 1 (sem telefone nem email): Recomenda busca pública de contato", () => {
    const lead = mockLead({ status: "novo", telefone: null, email: null, sinais: {} as any });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("pesquisa_canal");
    expect(action.title).toBe("Localizar Contato Público da Empresa");
    expect(action.guidance).toContain("Pesquise o site oficial ou o perfil no Google Maps");
  });

  it("Regra 2A: Contato realizado há menos de 48h sem resposta -> recomenda pausa técnica e esperar retorno", () => {
    const baseNow = new Date("2026-10-30T15:00:00Z");
    const lead = mockLead({
      status: "em_contato",
      custom_fields: {
        crm_flow: {
          ultima_interacao_em: "2026-10-30T09:00:00Z", // 6h atrás
          ultimo_canal_interacao: "whatsapp",
        },
      } as any,
    });

    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias, now: baseNow });

    expect(action.category).toBe("pausa_espera");
    expect(action.title).toContain("Aguardar Retorno Natural");
    expect(action.badgeLabel).toContain("Em Espera");
    expect(action.reason).toContain("Contatos diários consecutivos geram percepção de insistência");
    expect(action.guidance).toContain("Mantenha a pausa técnica de 48h");
    expect(action.isColdCadenceActive).toBe(true);
  });

  it("Regra 2B: Contato realizado há mais de 48h sem resposta -> recomenda follow-up consultivo (Dia 3)", () => {
    const baseNow = new Date("2026-10-30T15:00:00Z");
    const lead = mockLead({
      status: "em_contato",
      email: "contato@sorrisoprime.com.br",
      custom_fields: {
        crm_flow: {
          ultima_interacao_em: "2026-10-28T09:00:00Z", // 54h atrás
          ultimo_canal_interacao: "whatsapp",
        },
      } as any,
      plano_prospecao_7dias: [
        { dia: 1, canal: "whatsapp", mensagem: "m1", status_dia: "concluido" },
        { dia: 2, canal: "nenhum", mensagem: "", status_dia: "concluido" },
        { dia: 3, canal: "email", mensagem: "m3", status_dia: "pendente" },
        { dia: 4, canal: "nenhum", mensagem: "", status_dia: "pendente" },
        { dia: 5, canal: "whatsapp", mensagem: "m5", status_dia: "pendente" },
        { dia: 6, canal: "nenhum", mensagem: "", status_dia: "pendente" },
        { dia: 7, canal: "nenhum", mensagem: "", status_dia: "pendente" },
      ] as PlanoProspeccaoDia[],
    });

    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias, now: baseNow });

    expect(action.category).toBe("follow_up_cadencia");
    expect(action.title).toContain("Dia 3");
    expect(action.reason).toContain("Intervalo técnico de 48h");
    expect(action.isColdCadenceActive).toBe(true);
  });

  it("Regra 3: Lead respondeu com interesse ('qualificacao') -> interrompe cadência fria e recomenda qualificação", () => {
    const lead = mockLead({ status: "qualificacao" });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("qualificacao");
    expect(action.title).toContain("Qualificação (Interesse Demonstrado)");
    expect(action.badgeLabel).toContain("Qualificação · Interesse");
    expect(action.reason).toContain("A cadência fria foi interrompida imediatamente");
    expect(action.guidance).toContain("A cadência de prospecção fria foi pausada");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Regra 4: Lead solicitou informações ou preço nas notas -> orienta resposta consultiva à dúvida", () => {
    const lead = mockLead({
      status: "em_contato",
      notas: "A recepcionista perguntou qual o preco da automacao",
    });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("responder_duvida");
    expect(action.title).toContain("Responder Solicitação de Informações / Valores");
    expect(action.badgeLabel).toContain("Solicitou Informações");
    expect(action.guidance).toContain("Não envie mensagens de prospecção genéricas");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Regra 5: Lead em negociação -> orienta acompanhamento da proposta e fechamento", () => {
    const lead = mockLead({ status: "negociacao" });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("negociacao");
    expect(action.title).toContain("Lead em Negociação Ativa");
    expect(action.badgeLabel).toContain("Negociação Comercial");
    expect(action.guidance).toContain("A cadência fria está desativada");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Regra 6: Lead convertido -> orienta onboarding e pós-venda", () => {
    const lead = mockLead({ status: "convertido" });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("pos_venda");
    expect(action.title).toContain("Lead Convertido com Sucesso");
    expect(action.badgeLabel).toContain("Cliente Ganho");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Regra 7: Lead com opt-out explícito -> suspende contato e respeita recusa", () => {
    const lead = mockLead({
      status: "recusou_optout",
    });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("bloqueado_recusa");
    expect(action.title).toContain("Respeitar Recusa");
    expect(action.badgeLabel).toContain("Recusa / Opt-out");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Regra 7: Lead marcado como perdido -> arquiva oportunidade no funil", () => {
    const lead = mockLead({ status: "perdido" });
    const action = buildNextBestAction(lead, { plano: lead.plano_prospecao_7dias });

    expect(action.category).toBe("bloqueado_recusa");
    expect(action.title).toContain("Oportunidade Encerrada");
    expect(action.badgeLabel).toContain("Oportunidade Arquivada");
    expect(action.isColdCadenceActive).toBe(false);
  });

  it("Reconhece follow-up agendado no CRM e incorpora no resultado", () => {
    const baseNow = new Date("2026-10-30T10:00:00Z");
    const lead = mockLead({
      status: "qualificacao",
      custom_fields: {
        crm_flow: {
          proximo_follow_up_em: "2026-10-30T15:00:00Z",
          proxima_acao: "Ligar para o Dr. Marcelo (decisor)",
        },
      } as any,
    });

    const action = buildNextBestAction(lead, { now: baseNow });
    expect(action.scheduledFollowUp).not.toBeNull();
    expect(action.scheduledFollowUp?.isToday).toBe(true);
    expect(action.scheduledFollowUp?.action).toBe("Ligar para o Dr. Marcelo (decisor)");
  });

  describe("Simulação e Passagem do Tempo (Intervalos e Dias Úteis)", () => {
    it("calculateTimeIntervalMetrics calcula horas corridas e identifica fim de semana e dias úteis", () => {
      const tFriday = new Date("2026-10-30T10:00:00Z"); // Sexta-feira
      const tSaturday = new Date("2026-10-31T10:00:00Z"); // Sábado (+24h)
      const tSunday = new Date("2026-11-01T10:00:00Z"); // Domingo (+48h)
      const tMonday = new Date("2026-11-02T10:00:00Z"); // Segunda-feira (+72h)
      const tTuesday = new Date("2026-11-03T10:00:00Z"); // Terça-feira (+96h)

      // Sexta para Sábado: 24h corridas, fim de semana, 0 dias úteis
      const mSat = calculateTimeIntervalMetrics(tFriday, tSaturday);
      expect(mSat.calendarHours).toBe(24);
      expect(mSat.isWeekend).toBe(true);
      expect(mSat.dayOfWeekName).toBe("Sábado");
      expect(mSat.businessDays).toBe(0);

      // Sexta para Domingo: 48h corridas, fim de semana, 0 dias úteis
      const mSun = calculateTimeIntervalMetrics(tFriday, tSunday);
      expect(mSun.calendarHours).toBe(48);
      expect(mSun.isWeekend).toBe(true);
      expect(mSun.dayOfWeekName).toBe("Domingo");
      expect(mSun.businessDays).toBe(0);

      // Sexta para Segunda: 72h corridas, dia útil, 1 dia útil transcorrido
      const mMon = calculateTimeIntervalMetrics(tFriday, tMonday);
      expect(mMon.calendarHours).toBe(72);
      expect(mMon.isWeekend).toBe(false);
      expect(mMon.dayOfWeekName).toBe("Segunda-feira");
      expect(mMon.businessDays).toBe(1);

      // Sexta para Terça: 96h corridas, dia útil, 2 dias úteis transcorridos (48h úteis)
      const mTue = calculateTimeIntervalMetrics(tFriday, tTuesday);
      expect(mTue.calendarHours).toBe(96);
      expect(mTue.isWeekend).toBe(false);
      expect(mTue.businessDays).toBe(2);
    });

    it("quando o relógio avança para o fim de semana, recomenda pausa de fim de semana e aguardar segunda-feira", () => {
      const tFriday = new Date("2026-10-30T10:00:00Z");
      const tSaturday = new Date("2026-10-31T10:00:00Z"); // Sábado

      const lead = mockLead({
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            ultima_interacao_em: tFriday.toISOString(),
            ultimo_canal_interacao: "whatsapp",
          },
        } as any,
      });

      const action = buildNextBestAction(lead, { now: tSaturday, plano: lead.plano_prospecao_7dias });
      expect(action.category).toBe("pausa_espera");
      expect(action.title).toContain("Pausa de Fim de Semana");
      expect(action.badgeLabel).toContain("Fim de Semana");
      expect(action.guidance).toContain("Aguarde a reabertura comercial na segunda-feira");
    });

    it("quando o relógio avança além da data de follow-up, marca o follow-up como ATRASADO", () => {
      const now = new Date("2026-11-02T10:00:00Z"); // Segunda-feira
      const lead = mockLead({
        status: "qualificacao",
        custom_fields: {
          crm_flow: {
            proximo_follow_up_em: "2026-10-30T15:00:00Z", // Sexta passada
            proxima_acao: "Confirmar contratação",
          },
        } as any,
      });

      const action = buildNextBestAction(lead, { now });
      expect(action.scheduledFollowUp?.isOverdue).toBe(true);
      expect(action.scheduledFollowUp?.isToday).toBe(false);
    });

    it("quando o relógio avança após 3 tentativas concluídas, orienta encerramento formal no CRM", () => {
      const now = new Date("2026-11-05T10:00:00Z"); // Quinta-feira seguinte
      const lead = mockLead({
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            ultima_interacao_em: "2026-11-02T10:00:00Z",
          },
        } as any,
        plano_prospecao_7dias: [
          { dia: 1, canal: "whatsapp", mensagem: "m1", status_dia: "concluido" },
          { dia: 2, canal: "nenhum", mensagem: "", status_dia: "concluido" },
          { dia: 3, canal: "email", mensagem: "m3", status_dia: "concluido" },
          { dia: 4, canal: "nenhum", mensagem: "", status_dia: "concluido" },
          { dia: 5, canal: "whatsapp", mensagem: "m5", status_dia: "concluido" },
          { dia: 6, canal: "nenhum", mensagem: "", status_dia: "concluido" },
          { dia: 7, canal: "nenhum", mensagem: "", status_dia: "concluido" },
        ] as PlanoProspeccaoDia[],
      });

      const action = buildNextBestAction(lead, { now, plano: lead.plano_prospecao_7dias });
      expect(action.title).toContain("Encerrar Cadência Fria e Arquivar no CRM");
      expect(action.badgeLabel).toContain("Ciclo Concluído");
      expect(action.isColdCadenceActive).toBe(false);
    });
  });

  describe("Personalização por Maturidade Comercial (Iniciante, Intermediário, Avançado e Equilibrado)", () => {
    it("adota 'equilibrado' por padrão quando commercialMaturity não for informado", () => {
      const lead = mockLead({ status: "novo" });
      const action = buildNextBestAction(lead);
      expect(action.commercialMaturity).toBe("equilibrado");
      expect(action.guidance).toContain("abordagem profissional e objetiva");
    });

    it("ajusta a orientação de lead novo para perfil iniciante com linguagem acolhedora e sem jargões", () => {
      const lead = mockLead({ status: "novo" });
      const action = buildNextBestAction(lead, { commercialMaturity: "iniciante" });
      expect(action.commercialMaturity).toBe("iniciante");
      expect(action.guidance).toContain("Dê um primeiro passo simples");
      expect(action.guidance).toContain("Não se preocupe em vender nem falar de preços agora");
    });

    it("ajusta a orientação de lead novo para perfil intermediário com foco em qualificação", () => {
      const lead = mockLead({ status: "novo" });
      const action = buildNextBestAction(lead, { commercialMaturity: "intermediario" });
      expect(action.commercialMaturity).toBe("intermediario");
      expect(action.guidance).toContain("pergunta objetiva de qualificação");
    });

    it("ajusta a orientação de lead novo para perfil avançado com foco em alinhamento de processos e decisor", () => {
      const lead = mockLead({ status: "novo" });
      const action = buildNextBestAction(lead, { commercialMaturity: "avancado" });
      expect(action.commercialMaturity).toBe("avancado");
      expect(action.guidance).toContain("se este WhatsApp concentra os agendamentos");
      expect(action.guidance).toContain("qualificando rapidamente o canal");
    });

    it("em pausa técnica (< 48h), orienta paciência no iniciante e SLA no avançado", () => {
      const t0 = new Date("2026-10-30T10:00:00Z");
      const t1 = new Date("2026-10-30T20:00:00Z"); // 10h depois
      const lead = mockLead({
        status: "em_contato",
        custom_fields: {
          crm_flow: { ultima_interacao_em: t0.toISOString() },
        } as any,
      });

      const actIniciante = buildNextBestAction(lead, { now: t1, commercialMaturity: "iniciante" });
      expect(actIniciante.guidance).toContain("Tenha calma e não mande outra mensagem hoje");

      const actAvancado = buildNextBestAction(lead, { now: t1, commercialMaturity: "avancado" });
      expect(actAvancado.reason).toContain("SLA operacional");
      expect(actAvancado.guidance).toContain("Mantenha o status 'Em Contato' em observação");
    });

    it("em qualificação/interesse, orienta simpatia no iniciante e discovery consultivo no avançado", () => {
      const lead = mockLead({ status: "qualificacao" });

      const actIniciante = buildNextBestAction(lead, { commercialMaturity: "iniciante" });
      expect(actIniciante.reason).toContain("Boas notícias!");
      expect(actIniciante.guidance).toContain("sem afobação");

      const actAvancado = buildNextBestAction(lead, { commercialMaturity: "avancado" });
      expect(actAvancado.guidance).toContain("discovery consultivo");
      expect(actAvancado.guidance).toContain("critérios de decisão");
    });

    it("garante conformidade de verdade comercial: zero promessas de horas economizadas ou faturamento", () => {
      const lead = mockLead({ status: "novo" });
      const maturities = ["equilibrado", "iniciante", "intermediario", "avancado"] as const;

      maturities.forEach((mat) => {
        const action = buildNextBestAction(lead, { commercialMaturity: mat });
        expect(action.guidance).not.toMatch(/poupas+d+s+horas/i);
        expect(action.guidance).not.toMatch(/garantias+des+faturamento/i);
        expect(action.guidance).not.toMatch(/dobrars+vendas/i);
      });
    });
  });
});
