import type {
  CommercialGoalVersion,
  DayActivity,
  DailyPerformance,
  WeeklyPerformance,
  MonthlyPerformance,
  UserInteractionRecord,
} from "@/types/commercialPerformance";
import {
  getLocalDateString,
  getStartOfWeek,
  getEndOfWeek,
  getWeekDays,
  getStartOfMonth,
  getEndOfMonth,
  getDayOfWeekLabel,
  DEFAULT_TIMEZONE,
} from "./timezoneDateUtils";
import { getActiveGoalForDate } from "./commercialGoalsManager";
import type { LeadProspeccao } from "@/types/lead";

/**
 * Agrupa interações por data local (YYYY-MM-DD no fuso configurado).
 * Mapeia cada data para um Set de lead_ids únicos para garantir deduplicação
 * mesmo se o usuário registrar múltiplos contatos ou mensagens com o mesmo lead no mesmo dia.
 */
export function groupInteractionsByLocalDate(
  interactions: UserInteractionRecord[],
  timezone: string = DEFAULT_TIMEZONE
): Map<string, { leadIds: Set<string>; followUpsCount: number; interactions: UserInteractionRecord[] }> {
  const map = new Map<string, { leadIds: Set<string>; followUpsCount: number; interactions: UserInteractionRecord[] }>();

  for (const item of interactions) {
    if (!item.data_interacao) continue;
    const dateStr = getLocalDateString(item.data_interacao, timezone);
    if (!map.has(dateStr)) {
      map.set(dateStr, { leadIds: new Set<string>(), followUpsCount: 0, interactions: [] });
    }
    const entry = map.get(dateStr)!;
    if (item.lead_id) {
      entry.leadIds.add(item.lead_id);
    }
    if (item.tipo === "follow_up") {
      entry.followUpsCount++;
    }
    entry.interactions.push(item);
  }

  return map;
}

/**
 * Calcula a performance comercial diária.
 */
export function calculateDailyPerformance(
  interactions: UserInteractionRecord[],
  goalsHistory: CommercialGoalVersion[],
  leads: LeadProspeccao[],
  referenceDateInput: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): DailyPerformance {
  const todayStr = getLocalDateString(referenceDateInput, timezone);
  const activeGoal = getActiveGoalForDate(goalsHistory, todayStr);
  const target = Math.max(1, activeGoal.daily);

  const grouped = groupInteractionsByLocalDate(interactions, timezone);
  const todayEntry = grouped.get(todayStr);

  // Regra de Ouro: Contagem por lead_id único no dia para evitar inflação por duplicidade
  const completed = todayEntry ? todayEntry.leadIds.size : 0;
  const percent = Math.round((completed / target) * 100);
  const remaining = Math.max(0, target - completed);
  const isMet = completed >= target;

  // Follow-ups pendentes e atrasados extraídos dos leads
  let pendingFollowUps = 0;
  let overdueFollowUps = 0;
  let newLeadsAvailable = 0;

  for (const lead of leads) {
    if (lead.status === "novo") {
      newLeadsAvailable++;
    }

    // Checagem de fluxo operacional no custom_fields ou crm_flow
    const customFields = (lead as any).custom_fields;
    const crmFlow = customFields?.crm_flow;
    const nextFollowUpAt = crmFlow?.proximo_follow_up_em || (lead as any).next_follow_up_at;

    if (nextFollowUpAt) {
      const followUpDateStr = getLocalDateString(nextFollowUpAt, timezone);
      if (followUpDateStr === todayStr) {
        pendingFollowUps++;
      } else if (followUpDateStr < todayStr) {
        overdueFollowUps++;
      }
    }
  }

  return {
    date: todayStr,
    target,
    completed,
    percent,
    remaining,
    isMet,
    pendingFollowUps,
    overdueFollowUps,
    newLeadsAvailable,
  };
}

/**
 * Calcula a performance comercial semanal e o histograma diário (Segunda a Domingo).
 */
export function calculateWeeklyPerformance(
  interactions: UserInteractionRecord[],
  goalsHistory: CommercialGoalVersion[],
  referenceDateInput: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): WeeklyPerformance {
  const todayStr = getLocalDateString(referenceDateInput, timezone);
  const weekStart = getStartOfWeek(todayStr, timezone);
  const weekEnd = getEndOfWeek(todayStr, timezone);
  const weekDays = getWeekDays(todayStr, timezone);

  const activeGoal = getActiveGoalForDate(goalsHistory, weekStart);
  const target = Math.max(1, activeGoal.weekly);

  const grouped = groupInteractionsByLocalDate(interactions, timezone);

  // Set de leads únicos em toda a semana
  const weeklyUniqueLeads = new Set<string>();
  let activeDaysCount = 0;

  const dailyHistogram: DayActivity[] = weekDays.map((dayDateStr) => {
    const entry = grouped.get(dayDateStr);
    const dayContactsCount = entry ? entry.leadIds.size : 0;
    const dayFollowUpsCount = entry ? entry.followUpsCount : 0;
    const dayGoal = getActiveGoalForDate(goalsHistory, dayDateStr);

    if (entry) {
      for (const id of entry.leadIds) {
        weeklyUniqueLeads.add(id);
      }
    }

    if (dayContactsCount > 0) {
      activeDaysCount++;
    }

    const [, , d] = dayDateStr.split("-").map(Number);
    const isToday = dayDateStr === todayStr;
    const isFuture = dayDateStr > todayStr;

    return {
      date: dayDateStr,
      dayLabel: getDayOfWeekLabel(dayDateStr, timezone),
      dayNumber: d,
      contactsCount: dayContactsCount,
      followUpsCount: dayFollowUpsCount,
      target: dayGoal.daily,
      isToday,
      isFuture,
      isMet: dayContactsCount >= dayGoal.daily,
    };
  });

  const completed = weeklyUniqueLeads.size;
  const percent = Math.round((completed / target) * 100);
  const remaining = Math.max(0, target - completed);
  const isMet = completed >= target;

  return {
    weekStart,
    weekEnd,
    target,
    completed,
    percent,
    remaining,
    isMet,
    dailyHistogram,
    activeDaysCount,
  };
}

/**
 * Calcula a performance comercial mensal com segregação de funil.
 */
export function calculateMonthlyPerformance(
  interactions: UserInteractionRecord[],
  goalsHistory: CommercialGoalVersion[],
  leads: LeadProspeccao[],
  referenceDateInput: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): MonthlyPerformance {
  const todayStr = getLocalDateString(referenceDateInput, timezone);
  const monthStart = getStartOfMonth(todayStr);
  const monthEnd = getEndOfMonth(todayStr);

  const activeGoal = getActiveGoalForDate(goalsHistory, monthStart);
  const target = Math.max(1, activeGoal.monthly);

  const grouped = groupInteractionsByLocalDate(interactions, timezone);

  const monthlyUniqueLeads = new Set<string>();
  let activeDaysCount = 0;
  let totalInteractions = 0;

  for (const [dateStr, entry] of grouped.entries()) {
    if (dateStr >= monthStart && dateStr <= monthEnd) {
      if (entry.leadIds.size > 0) {
        activeDaysCount++;
      }
      for (const id of entry.leadIds) {
        monthlyUniqueLeads.add(id);
      }
      totalInteractions += entry.interactions.length;
    }
  }

  const completed = monthlyUniqueLeads.size;
  const percent = Math.round((completed / target) * 100);
  const remaining = Math.max(0, target - completed);
  const isMet = completed >= target;

  // Segregação de resultados de funil (Conversões / Vendas vs Atividades)
  const funnelOutcomes = {
    novo: 0,
    em_contato: 0,
    qualificacao: 0,
    negociacao: 0,
    convertido: 0,
    perdido: 0,
  };

  for (const lead of leads) {
    const st = lead.status as keyof typeof funnelOutcomes;
    if (st && typeof funnelOutcomes[st] === "number") {
      funnelOutcomes[st]++;
    }
  }

  return {
    month: todayStr.slice(0, 7),
    target,
    completed,
    percent,
    remaining,
    isMet,
    activeDaysCount,
    totalInteractions,
    funnelOutcomes,
  };
}
