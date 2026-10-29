import type { CommercialGoalVersion } from "@/types/commercialPerformance";

export const DEFAULT_GOAL_CONFIG: CommercialGoalVersion = {
  id: "default",
  effective_from: "2026-01-01",
  daily: 5,
  weekly: 25,
  monthly: 110,
  workdays_per_week: 5,
  created_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Encontra a versão da meta vigente em uma data específica (YYYY-MM-DD).
 * Algoritmo: localiza todas as versões com `effective_from <= targetDate`
 * e retorna a que tiver o `effective_from` mais recente.
 * Se nenhuma versão for encontrada, retorna a versão padrão.
 */
export function getActiveGoalForDate(
  history: CommercialGoalVersion[] = [],
  targetDateStr: string
): CommercialGoalVersion {
  if (!history || history.length === 0) {
    return DEFAULT_GOAL_CONFIG;
  }

  const eligibleVersions = history
    .filter((v) => v.effective_from <= targetDateStr)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  return eligibleVersions[0] || history[0] || DEFAULT_GOAL_CONFIG;
}

/**
 * Sugere metas semanal e mensal a partir da meta diária e dos dias úteis.
 * - Semanal = diária * dias úteis na semana (ex: 5 * 5 = 25)
 * - Mensal = diária * dias úteis estimados no mês (ex: 5 * 22 = 110)
 */
export function calculateSuggestedGoals(
  daily: number,
  workdaysPerWeek = 5,
  workdaysInMonth = 22
): { weekly: number; monthly: number } {
  const safeDaily = Math.max(1, Math.round(daily));
  const safeWorkdays = Math.max(1, Math.min(7, Math.round(workdaysPerWeek)));
  const safeMonthDays = Math.max(1, Math.round(workdaysInMonth));

  return {
    weekly: safeDaily * safeWorkdays,
    monthly: safeDaily * safeMonthDays,
  };
}

/**
 * Cria ou atualiza uma versão de metas para o histórico.
 * Invariante de Negócio: Alterações de metas valem prospectivamente (a partir da data de hoje),
 * sem reescrever ou alterar percentuais e metas de dias/semanas passadas.
 * Se já existir uma versão criada exatamente na mesma data `todayStr`, ela é atualizada.
 * Caso contrário, uma nova versão é anexada à lista histórica.
 */
export function createOrUpdateGoalVersion(
  currentHistory: CommercialGoalVersion[] = [],
  newGoals: {
    daily: number;
    weekly: number;
    monthly: number;
    workdays_per_week?: number;
  },
  todayStr: string
): CommercialGoalVersion[] {
  const safeHistory = Array.isArray(currentHistory) ? [...currentHistory] : [];
  const safeDaily = Math.max(1, Math.round(newGoals.daily));
  const safeWeekly = Math.max(1, Math.round(newGoals.weekly));
  const safeMonthly = Math.max(1, Math.round(newGoals.monthly));
  const safeWorkdays = Math.max(1, Math.min(7, Math.round(newGoals.workdays_per_week ?? 5)));

  const existingTodayIndex = safeHistory.findIndex((v) => v.effective_from === todayStr);

  const updatedVersion: CommercialGoalVersion = {
    id: existingTodayIndex >= 0 ? safeHistory[existingTodayIndex].id : `goal_${Date.now()}`,
    effective_from: todayStr,
    daily: safeDaily,
    weekly: safeWeekly,
    monthly: safeMonthly,
    workdays_per_week: safeWorkdays,
    created_at: new Date().toISOString(),
  };

  if (existingTodayIndex >= 0) {
    safeHistory[existingTodayIndex] = updatedVersion;
  } else {
    safeHistory.push(updatedVersion);
  }

  // Ordena cronologicamente por effective_from
  return safeHistory.sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}
