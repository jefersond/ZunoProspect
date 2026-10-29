import { describe, it, expect } from "vitest";
import {
  getLocalDateString,
  getStartOfWeek,
  getEndOfWeek,
  getWeekDays,
  getStartOfMonth,
  getEndOfMonth,
  getDayOfWeekLabel,
  formatDayMonth,
  DEFAULT_TIMEZONE,
} from "./timezoneDateUtils";
import {
  DEFAULT_GOAL_CONFIG,
  getActiveGoalForDate,
  calculateSuggestedGoals,
  createOrUpdateGoalVersion,
} from "./commercialGoalsManager";
import {
  calculateDailyPerformance,
  calculateWeeklyPerformance,
  calculateMonthlyPerformance,
} from "./commercialAggregator";
import type { CommercialGoalVersion } from "@/types/commercialPerformance";

describe("timezoneDateUtils · Gestão de Fusos Horários e Limites Comerciais", () => {
  it("converte timestamp UTC para o dia local correto no fuso de Brasília", () => {
    // 2026-10-30T01:30:00Z em UTC equivale a 2026-10-29T22:30:00 no fuso de Brasília (GMT-3)
    const utcDate = new Date("2026-10-30T01:30:00Z");
    const localDate = getLocalDateString(utcDate, "America/Sao_Paulo");
    expect(localDate).toBe("2026-10-29");
  });

  it("calcula corretamente a diferença entre fusos brasileiros (São Paulo vs Manaus vs Rio Branco)", () => {
    // 2026-10-30T03:30:00Z
    // Em SP (GMT-3): 00:30 do dia 30
    // Em Manaus (GMT-4): 23:30 do dia 29
    // Em Rio Branco (GMT-5): 22:30 do dia 29
    const utcDate = new Date("2026-10-30T03:30:00Z");
    expect(getLocalDateString(utcDate, "America/Sao_Paulo")).toBe("2026-10-30");
    expect(getLocalDateString(utcDate, "America/Manaus")).toBe("2026-10-29");
    expect(getLocalDateString(utcDate, "America/Rio_Branco")).toBe("2026-10-29");
  });

  it("determina que a semana comercial começa na Segunda-feira e termina no Domingo", () => {
    // 2026-10-29 é uma Quinta-feira
    const dateStr = "2026-10-29";
    const startOfWeek = getStartOfWeek(dateStr, DEFAULT_TIMEZONE);
    const endOfWeek = getEndOfWeek(dateStr, DEFAULT_TIMEZONE);
    const weekDays = getWeekDays(dateStr, DEFAULT_TIMEZONE);

    expect(startOfWeek).toBe("2026-10-26"); // Segunda-feira
    expect(endOfWeek).toBe("2026-11-01");   // Domingo
    expect(weekDays).toHaveLength(7);
    expect(weekDays[0]).toBe("2026-10-26"); // Seg
    expect(weekDays[1]).toBe("2026-10-27"); // Ter
    expect(weekDays[2]).toBe("2026-10-28"); // Qua
    expect(weekDays[3]).toBe("2026-10-29"); // Qui
    expect(weekDays[4]).toBe("2026-10-30"); // Sex
    expect(weekDays[5]).toBe("2026-10-31"); // Sáb
    expect(weekDays[6]).toBe("2026-11-01"); // Dom
  });

  it("retorna o rótulo do dia da semana correto em português", () => {
    expect(getDayOfWeekLabel("2026-10-26")).toBe("Seg");
    expect(getDayOfWeekLabel("2026-10-27")).toBe("Ter");
    expect(getDayOfWeekLabel("2026-10-28")).toBe("Qua");
    expect(getDayOfWeekLabel("2026-10-29")).toBe("Qui");
    expect(getDayOfWeekLabel("2026-10-30")).toBe("Sex");
    expect(getDayOfWeekLabel("2026-10-31")).toBe("Sáb");
    expect(getDayOfWeekLabel("2026-11-01")).toBe("Dom");
  });

  it("calcula início e fim de mês com precisão", () => {
    expect(getStartOfMonth("2026-10-29")).toBe("2026-10-01");
    expect(getEndOfMonth("2026-10-29")).toBe("2026-10-31");
    expect(getStartOfMonth("2026-02-15")).toBe("2026-02-01");
    expect(getEndOfMonth("2026-02-15")).toBe("2026-02-28");
  });

  it("formata dia e mês sem inventar dados", () => {
    expect(formatDayMonth("2026-10-29")).toBe("29/10");
  });
});

describe("commercialGoalsManager · Imutabilidade Histórica e Versionamento de Metas", () => {
  it("utiliza meta padrão quando histórico for vazio", () => {
    const goal = getActiveGoalForDate([], "2026-10-29");
    expect(goal.daily).toBe(DEFAULT_GOAL_CONFIG.daily);
    expect(goal.weekly).toBe(DEFAULT_GOAL_CONFIG.weekly);
    expect(goal.monthly).toBe(DEFAULT_GOAL_CONFIG.monthly);
  });

  it("preserva rigorosamente metas históricas em períodos anteriores à alteração", () => {
    // Histórico com meta de 5 diários em janeiro e aumento para 10 diários em 15 de outubro
    const history: CommercialGoalVersion[] = [
      {
        id: "v1",
        effective_from: "2026-01-01",
        daily: 5,
        weekly: 25,
        monthly: 110,
        workdays_per_week: 5,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "v2",
        effective_from: "2026-10-15",
        daily: 10,
        weekly: 50,
        monthly: 220,
        workdays_per_week: 5,
        created_at: "2026-10-15T00:00:00Z",
      },
    ];

    // Data antes de 15 de outubro deve receber v1 (meta = 5)
    const goalBefore = getActiveGoalForDate(history, "2026-10-10");
    expect(goalBefore.daily).toBe(5);
    expect(goalBefore.weekly).toBe(25);

    // Data exatamente no dia 15 ou posterior recebe v2 (meta = 10)
    const goalOnDate = getActiveGoalForDate(history, "2026-10-15");
    expect(goalOnDate.daily).toBe(10);
    expect(goalOnDate.weekly).toBe(50);

    const goalAfter = getActiveGoalForDate(history, "2026-10-29");
    expect(goalAfter.daily).toBe(10);
    expect(goalAfter.monthly).toBe(220);
  });

  it("permite metas semanais e mensais independentes da fórmula de sugestão", () => {
    const suggested = calculateSuggestedGoals(5, 5, 22);
    expect(suggested.weekly).toBe(25);
    expect(suggested.monthly).toBe(110);

    // O usuário é livre para customizar valores totalmente independentes
    const history = createOrUpdateGoalVersion(
      [],
      {
        daily: 7,
        weekly: 30, // Independente de 7 * 5 = 35
        monthly: 100, // Independente de 7 * 22 = 154
        workdays_per_week: 5,
      },
      "2026-10-29"
    );

    const active = getActiveGoalForDate(history, "2026-10-29");
    expect(active.daily).toBe(7);
    expect(active.weekly).toBe(30);
    expect(active.monthly).toBe(100);
  });

  it("atualiza a versão de hoje se houver múltiplas alterações no mesmo dia sem inflar o histórico", () => {
    let history = createOrUpdateGoalVersion(
      [],
      { daily: 5, weekly: 25, monthly: 110 },
      "2026-10-29"
    );
    expect(history).toHaveLength(1);
    expect(history[0].daily).toBe(5);

    // Usuário altera de novo no mesmo dia
    history = createOrUpdateGoalVersion(
      history,
      { daily: 8, weekly: 40, monthly: 176 },
      "2026-10-29"
    );
    expect(history).toHaveLength(1);
    expect(history[0].daily).toBe(8);
  });
});

describe("commercialAggregator · Deduplicação Confiável e Segregação de Atividade vs Resultados", () => {
  const mockGoals: CommercialGoalVersion[] = [
    {
      id: "v1",
      effective_from: "2026-10-01",
      daily: 5,
      weekly: 25,
      monthly: 100,
      workdays_per_week: 5,
      created_at: "2026-10-01T00:00:00Z",
    },
  ];

  it("deduplica múltiplos contatos com o mesmo lead no mesmo dia (não infla meta diária)", () => {
    // 3 interações registradas no mesmo dia (2026-10-29), sendo 2 com o lead 'lead-1' e 1 com 'lead-2'
    const interactions = [
      {
        id: "int-1",
        user_id: "user-1",
        lead_id: "lead-1",
        tipo: "primeira_abordagem",
        conteudo: "Mensagem enviada",
        data_interacao: "2026-10-29T10:00:00-03:00",
      },
      {
        id: "int-2",
        user_id: "user-1",
        lead_id: "lead-1", // Mesmo lead no mesmo dia!
        tipo: "follow_up",
        conteudo: "Retorno pelo WhatsApp",
        data_interacao: "2026-10-29T14:30:00-03:00",
      },
      {
        id: "int-3",
        user_id: "user-1",
        lead_id: "lead-2",
        tipo: "primeira_abordagem",
        conteudo: "Abordagem inicial",
        data_interacao: "2026-10-29T16:00:00-03:00",
      },
    ];

    const daily = calculateDailyPerformance(interactions, mockGoals, [], "2026-10-29", DEFAULT_TIMEZONE);
    // Deve contar exatamente 2 contatos únicos (lead-1 e lead-2), não 3
    expect(daily.completed).toBe(2);
    expect(daily.target).toBe(5);
    expect(daily.percent).toBe(40); // 2 de 5 = 40%
    expect(daily.remaining).toBe(3);
    expect(daily.isMet).toBe(false);
  });

  it("calcula histograma semanal com 7 barras e contagem de dias ativos", () => {
    // Semana de 2026-10-26 a 2026-11-01
    const interactions = [
      {
        id: "int-1",
        user_id: "user-1",
        lead_id: "lead-1",
        tipo: "primeira_abordagem",
        conteudo: "Segunda",
        data_interacao: "2026-10-26T10:00:00-03:00",
      },
      {
        id: "int-2",
        user_id: "user-1",
        lead_id: "lead-2",
        tipo: "primeira_abordagem",
        conteudo: "Terça",
        data_interacao: "2026-10-27T10:00:00-03:00",
      },
      {
        id: "int-3",
        user_id: "user-1",
        lead_id: "lead-3",
        tipo: "primeira_abordagem",
        conteudo: "Quinta",
        data_interacao: "2026-10-29T10:00:00-03:00",
      },
    ];

    const weekly = calculateWeeklyPerformance(interactions, mockGoals, "2026-10-29", DEFAULT_TIMEZONE);
    expect(weekly.dailyHistogram).toHaveLength(7);
    expect(weekly.completed).toBe(3);
    expect(weekly.activeDaysCount).toBe(3);
    expect(weekly.target).toBe(25);
    expect(weekly.percent).toBe(12);

    // Segunda (2026-10-26) deve ter 1 contato
    expect(weekly.dailyHistogram[0].contactsCount).toBe(1);
    expect(weekly.dailyHistogram[0].isToday).toBe(false);

    // Quinta (2026-10-29) deve ter 1 contato e isToday = true
    expect(weekly.dailyHistogram[3].contactsCount).toBe(1);
    expect(weekly.dailyHistogram[3].isToday).toBe(true);

    // Sexta (2026-10-30) deve ser futuro em relação a 2026-10-29
    expect(weekly.dailyHistogram[4].isFuture).toBe(true);
  });

  it("segrega rigorosamente atividades comerciais (volume) de resultados de funil (conversão)", () => {
    const interactions = [
      {
        id: "int-1",
        user_id: "user-1",
        lead_id: "lead-1",
        tipo: "primeira_abordagem",
        conteudo: "Abordagem",
        data_interacao: "2026-10-10T10:00:00-03:00",
      },
      {
        id: "int-2",
        user_id: "user-1",
        lead_id: "lead-2",
        tipo: "follow_up",
        conteudo: "Follow-up",
        data_interacao: "2026-10-15T10:00:00-03:00",
      },
    ];

    const leads: any[] = [
      { id: "lead-1", status: "em_contato" },
      { id: "lead-2", status: "negociacao" },
      { id: "lead-3", status: "convertido" }, // Venda fechada!
      { id: "lead-4", status: "novo" },
    ];

    const monthly = calculateMonthlyPerformance(interactions, mockGoals, leads, "2026-10-29", DEFAULT_TIMEZONE);
    
    // Atividade mensal: 2 contatos realizados
    expect(monthly.completed).toBe(2);
    expect(monthly.activeDaysCount).toBe(2);

    // Resultados de funil segregated: vendas e negociações não são confundidas com volume de contatos
    expect(monthly.funnelOutcomes.convertido).toBe(1);
    expect(monthly.funnelOutcomes.negociacao).toBe(1);
    expect(monthly.funnelOutcomes.em_contato).toBe(1);
    expect(monthly.funnelOutcomes.novo).toBe(1);
  });

  it("identifica corretamente follow-ups pendentes para hoje e atrasados", () => {
    const leads: any[] = [
      {
        id: "lead-1",
        nome: "Lead 1",
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            proximo_follow_up_em: "2026-10-29T10:00:00-03:00", // Hoje
          },
        },
      },
      {
        id: "lead-2",
        nome: "Lead 2",
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            proximo_follow_up_em: "2026-10-25T10:00:00-03:00", // Atrasado
          },
        },
      },
      {
        id: "lead-3",
        nome: "Lead 3",
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            proximo_follow_up_em: "2026-11-05T10:00:00-03:00", // Futuro
          },
        },
      },
    ];

    const daily = calculateDailyPerformance([], mockGoals, leads, "2026-10-29", DEFAULT_TIMEZONE);
    expect(daily.pendingFollowUps).toBe(1);
    expect(daily.overdueFollowUps).toBe(1);
  });
});


