// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CommercialPerformanceDashboard } from "./CommercialPerformanceDashboard";
import { ConfirmContactModal } from "./ConfirmContactModal";
import { AdjustGoalsModal } from "./AdjustGoalsModal";
import type {
  DailyPerformance,
  WeeklyPerformance,
  MonthlyPerformance,
  CommercialGoalVersion,
} from "@/types/commercialPerformance";

afterEach(() => {
  cleanup();
});

describe("CommercialPerformanceDashboard · Interface de Metas e Desempenho", () => {
  const mockGoal: CommercialGoalVersion = {
    id: "v1",
    effective_from: "2026-10-01",
    daily: 5,
    weekly: 25,
    monthly: 100,
    workdays_per_week: 5,
    created_at: "2026-10-01T00:00:00Z",
  };

  const mockDaily: DailyPerformance = {
    date: "2026-10-29",
    target: 5,
    completed: 3,
    percent: 60,
    remaining: 2,
    isMet: false,
    pendingFollowUps: 2,
    overdueFollowUps: 1,
    newLeadsAvailable: 10,
  };

  const mockWeekly: WeeklyPerformance = {
    weekStart: "2026-10-26",
    weekEnd: "2026-11-01",
    target: 25,
    completed: 15,
    percent: 60,
    remaining: 10,
    isMet: false,
    activeDaysCount: 3,
    dailyHistogram: [
      { date: "2026-10-26", dayLabel: "Seg", dayNumber: 26, contactsCount: 5, followUpsCount: 1, target: 5, isToday: false, isFuture: false, isMet: true },
      { date: "2026-10-27", dayLabel: "Ter", dayNumber: 27, contactsCount: 4, followUpsCount: 0, target: 5, isToday: false, isFuture: false, isMet: false },
      { date: "2026-10-28", dayLabel: "Qua", dayNumber: 28, contactsCount: 3, followUpsCount: 1, target: 5, isToday: false, isFuture: false, isMet: false },
      { date: "2026-10-29", dayLabel: "Qui", dayNumber: 29, contactsCount: 3, followUpsCount: 0, target: 5, isToday: true, isFuture: false, isMet: false },
      { date: "2026-10-30", dayLabel: "Sex", dayNumber: 30, contactsCount: 0, followUpsCount: 0, target: 5, isToday: false, isFuture: true, isMet: false },
      { date: "2026-10-31", dayLabel: "Sáb", dayNumber: 31, contactsCount: 0, followUpsCount: 0, target: 5, isToday: false, isFuture: true, isMet: false },
      { date: "2026-11-01", dayLabel: "Dom", dayNumber: 1, contactsCount: 0, followUpsCount: 0, target: 5, isToday: false, isFuture: true, isMet: false },
    ],
  };

  const mockMonthly: MonthlyPerformance = {
    month: "2026-10",
    target: 100,
    completed: 45,
    percent: 45,
    remaining: 55,
    isMet: false,
    activeDaysCount: 12,
    totalInteractions: 58,
    funnelOutcomes: {
      novo: 14,
      em_contato: 8,
      qualificacao: 5,
      negociacao: 3,
      convertido: 2,
      perdido: 1,
    },
  };

  it("renderiza o cabeçalho, indicador de fuso e as 3 abas (Diário, Semanal, Mensal)", () => {
    render(
      <CommercialPerformanceDashboard
        daily={mockDaily}
        weekly={mockWeekly}
        monthly={mockMonthly}
        activeGoal={mockGoal}
        timezone="America/Sao_Paulo"
        onSaveGoals={vi.fn()}
        onSaveTimezone={vi.fn()}
        onRegisterContact={vi.fn()}
      />
    );

    expect(screen.getByText("Desempenho Comercial")).toBeTruthy();
    expect(screen.getByText(/Horário de Brasília/)).toBeTruthy();
    expect(screen.getByText("Auto-registro transparente")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Diário" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Semanal" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Mensal" })).toBeTruthy();
  });

  it("exibe na aba Diário a meta de contatos, percentual e follow-ups pendentes/atrasados", () => {
    render(
      <CommercialPerformanceDashboard
        daily={mockDaily}
        weekly={mockWeekly}
        monthly={mockMonthly}
        activeGoal={mockGoal}
        timezone="America/Sao_Paulo"
        onSaveGoals={vi.fn()}
        onSaveTimezone={vi.fn()}
        onRegisterContact={vi.fn()}
      />
    );

    expect(screen.getByText("de 5 contatos realizados hoje")).toBeTruthy();
    expect(screen.getByText("60% concluído")).toBeTruthy();
    expect(screen.getByText("Restam 2 contatos para atingir sua meta.")).toBeTruthy();
    expect(screen.getByText("Follow-ups para hoje")).toBeTruthy();
    expect(screen.getByText("Follow-ups atrasados")).toBeTruthy();
    expect(screen.getByText("Leads novos na base")).toBeTruthy();
  });

  it("exibe na aba Semanal o histograma de 7 dias com rótulos de Segunda a Domingo", () => {
    render(
      <CommercialPerformanceDashboard
        daily={mockDaily}
        weekly={mockWeekly}
        monthly={mockMonthly}
        activeGoal={mockGoal}
        timezone="America/Sao_Paulo"
        defaultTab="semanal"
        onSaveGoals={vi.fn()}
        onSaveTimezone={vi.fn()}
        onRegisterContact={vi.fn()}
      />
    );

    expect(screen.getByText(/25 contatos nesta semana/)).toBeTruthy();
    expect(screen.getByText("3 de 7 dias com prospecção ativa nesta semana.")).toBeTruthy();
    expect(screen.getByText("Atividade Diária da Semana (Segunda a Domingo)")).toBeTruthy();
    expect(screen.getByText("Seg")).toBeTruthy();
    expect(screen.getByText("Ter")).toBeTruthy();
    expect(screen.getByText("Qua")).toBeTruthy();
    expect(screen.getByText("Qui")).toBeTruthy();
    expect(screen.getByText("Sex")).toBeTruthy();
    expect(screen.getByText("Sáb")).toBeTruthy();
    expect(screen.getByText("Dom")).toBeTruthy();
  });

  it("exibe na aba Mensal a segregação estrita entre atividades e resultados de funil", () => {
    render(
      <CommercialPerformanceDashboard
        daily={mockDaily}
        weekly={mockWeekly}
        monthly={mockMonthly}
        activeGoal={mockGoal}
        timezone="America/Sao_Paulo"
        defaultTab="mensal"
        onSaveGoals={vi.fn()}
        onSaveTimezone={vi.fn()}
        onRegisterContact={vi.fn()}
      />
    );

    expect(screen.getByText(/100 contatos realizados no mês/)).toBeTruthy();
    expect(screen.getByText("12 dias com prospecção ativa neste mês.")).toBeTruthy();
    expect(screen.getByText(/Resultados de Funil \(Status Atual dos Leads\)/)).toBeTruthy();
    expect(screen.getByText("Métricas de conversão segregadas de atividades")).toBeTruthy();
    expect(screen.getByText("Em Negociação")).toBeTruthy();
    expect(screen.getByText("Clientes Convertidos")).toBeTruthy();
  });
});

describe("ConfirmContactModal · Confirmação Explícita de Contato (Anti-Auto-Count)", () => {
  it("exige confirmação explícita do usuário antes de contabilizar o contato", async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(true);
    const onOpenChangeMock = vi.fn();

    render(
      <ConfirmContactModal
        open={true}
        onOpenChange={onOpenChangeMock}
        leadId="lead-123"
        leadNome="Padaria Central"
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.getByText("Confirmar Contato Realizado")).toBeTruthy();
    expect(screen.getByText(/Padaria Central/)).toBeTruthy();

    const submitBtn = screen.getByRole("button", { name: "Confirmar e Contabilizar Contato" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onConfirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-123",
          leadNome: "Padaria Central",
          tipo: "primeira_abordagem",
        })
      );
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });
  });
});

describe("AdjustGoalsModal · Personalização de Metas e Fuso Horário", () => {
  it("permite sugerir metas a partir da diária e salva prospectivamente", async () => {
    const onSaveGoalsMock = vi.fn().mockResolvedValue(true);
    const onSaveTimezoneMock = vi.fn().mockResolvedValue(true);
    const onOpenChangeMock = vi.fn();

    render(
      <AdjustGoalsModal
        open={true}
        onOpenChange={onOpenChangeMock}
        activeGoal={{
          id: "v1",
          effective_from: "2026-10-01",
          daily: 10,
          weekly: 50,
          monthly: 220,
          workdays_per_week: 5,
          created_at: "2026-10-01T00:00:00Z",
        }}
        timezone="America/Sao_Paulo"
        onSaveGoals={onSaveGoalsMock}
        onSaveTimezone={onSaveTimezoneMock}
      />
    );

    expect(screen.getByText("Personalizar Metas Comerciais")).toBeTruthy();
    expect(screen.getByText(/Fuso Horário de Trabalho/)).toBeTruthy();

    const saveBtn = screen.getByRole("button", { name: "Salvar Metas" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaveGoalsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          daily: 10,
          weekly: 50,
          monthly: 220,
        })
      );
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });
  });
});
