/**
 * Utilitários de fuso horário e manipulação de datas para metas comerciais da Zuno Prospect.
 * Garante que os limites de dias, semanas e meses sejam estritamente calculados
 * no fuso horário configurado pelo usuário, sem depender do relógio local do navegador.
 */

export interface TimezoneOption {
  value: string;
  label: string;
  offsetLabel: string;
}

export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  { value: "America/Sao_Paulo", label: "Horário de Brasília (SP, RJ, MG, Sul)", offsetLabel: "GMT-3" },
  { value: "America/Manaus", label: "Horário do Amazonas (Manaus)", offsetLabel: "GMT-4" },
  { value: "America/Cuiaba", label: "Horário de Cuiabá (MT, MS)", offsetLabel: "GMT-4" },
  { value: "America/Fortaleza", label: "Horário do Nordeste (CE, MA, PI, RN, PB)", offsetLabel: "GMT-3" },
  { value: "America/Belem", label: "Horário de Belém (PA, AP)", offsetLabel: "GMT-3" },
  { value: "America/Recife", label: "Horário de Pernambuco (PE, AL, SE)", offsetLabel: "GMT-3" },
  { value: "America/Porto_Velho", label: "Horário de Rondônia (Porto Velho)", offsetLabel: "GMT-4" },
  { value: "America/Rio_Branco", label: "Horário do Acre (Rio Branco)", offsetLabel: "GMT-5" },
  { value: "America/Noronha", label: "Horário de Fernando de Noronha", offsetLabel: "GMT-2" },
];

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Converte um timestamp, Date ou string ISO para string de data YYYY-MM-DD
 * no fuso horário informado.
 */
export function getLocalDateString(
  dateInput: Date | string | number = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  try {
    if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) {
      return fallbackToTodayDate();
    }
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch (err) {
    console.warn(`[timezoneDateUtils] Erro ao formatar data com timezone ${timezone}, usando fallback:`, err);
    return fallbackToTodayDate();
  }
}

function fallbackToTodayDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna os componentes de data (ano, mês, dia, dia da semana) no fuso especificado.
 */
export function getDateParts(
  dateInput: Date | string | number = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
} {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
  });
  
  // Usar formatToParts para extração precisa
  const parts = formatter.formatToParts(date);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    if (part.type === "month") month = parseInt(part.value, 10);
    if (part.type === "day") day = parseInt(part.value, 10);
  }

  // Dia da semana calculado com base no meio do dia local
  const localMidday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = localMidday.getUTCDay();

  return { year, month, day, dayOfWeek };
}

/**
 * Retorna a Segunda-feira (início da semana comercial) correspondente à data fornecida.
 */
export function getStartOfWeek(
  dateStr: string, // YYYY-MM-DD
  timezone: string = DEFAULT_TIMEZONE
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const midday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const { dayOfWeek } = getDateParts(midday, timezone);

  // Segunda-feira é 1. Domingo é 0 (considerado fim da semana anterior ou domingo da semana corrente).
  // No padrão comercial brasileiro, a semana começa na Segunda (1) e termina no Domingo (0).
  // Se for Domingo (0), subtrai 6 dias para achar a segunda anterior.
  // Se for Segunda (1), subtrai 0.
  // Se for Terça (2), subtrai 1...
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const mondayDate = new Date(Date.UTC(y, m - 1, d - daysToSubtract, 12, 0, 0));
  return getLocalDateString(mondayDate, timezone);
}

/**
 * Retorna o Domingo (fim da semana comercial) correspondente à data fornecida.
 */
export function getEndOfWeek(
  dateStr: string, // YYYY-MM-DD
  timezone: string = DEFAULT_TIMEZONE
): string {
  const mondayStr = getStartOfWeek(dateStr, timezone);
  const [y, m, d] = mondayStr.split("-").map(Number);
  const sundayDate = new Date(Date.UTC(y, m - 1, d + 6, 12, 0, 0));
  return getLocalDateString(sundayDate, timezone);
}

/**
 * Retorna as 7 datas (YYYY-MM-DD) da semana comercial (Segunda a Domingo).
 */
export function getWeekDays(
  dateStr: string, // YYYY-MM-DD
  timezone: string = DEFAULT_TIMEZONE
): string[] {
  const mondayStr = getStartOfWeek(dateStr, timezone);
  const [y, m, d] = mondayStr.split("-").map(Number);
  const days: string[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    days.push(getLocalDateString(dayDate, timezone));
  }

  return days;
}

/**
 * Retorna o primeiro dia do mês (YYYY-MM-01).
 */
export function getStartOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}-${m}-01`;
}

/**
 * Retorna o último dia do mês (YYYY-MM-DD).
 */
export function getEndOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  // O dia 0 do mês seguinte é o último dia do mês atual
  const lastDayDate = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const lastDay = String(lastDayDate.getUTCDate()).padStart(2, "0");
  const monthStr = String(m).padStart(2, "0");
  return `${y}-${monthStr}-${lastDay}`;
}

/**
 * Rótulo curto do dia da semana em português (Seg, Ter, Qua, Qui, Sex, Sáb, Dom).
 */
export function getDayOfWeekLabel(dateStr: string, timezone: string = DEFAULT_TIMEZONE): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const midday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const { dayOfWeek } = getDateParts(midday, timezone);

  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return labels[dayOfWeek] || "";
}

/**
 * Formata para exibição simples (ex: 29/10).
 */
export function formatDayMonth(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

/**
 * Nome do mês em português (Janeiro, Fevereiro, etc.)
 */
export function getMonthName(dateStr: string): string {
  const [, m] = dateStr.split("-").map(Number);
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[(m || 1) - 1] || "";
}
