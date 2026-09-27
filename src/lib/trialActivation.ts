import { getPlanPeriodLabel, getPlanPrice, normalizePlanId, type BillingCycle } from "@/config/plans";

export const TRIAL_TIME_ZONE = "America/Sao_Paulo";

export type TrialUiState = "loading" | "error" | "none" | "trialing" | "active" | "cancelled" | "past_due" | "other";

export type TrialUiSubscription = {
  subscription_status?: string | null;
  status?: string | null;
  billing_provider?: "stripe" | "mercado_pago" | null;
  trial_start?: string | null;
  trial_end?: string | null;
};

export function resolveTrialUiState(input: {
  subscription: TrialUiSubscription | null;
  loading: boolean;
  error: string | null;
}): TrialUiState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.subscription) return "none";

  const status = String(
    input.subscription.subscription_status ?? input.subscription.status ?? "",
  ).trim().toLowerCase();

  if (!status || status === "free") return "none";
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (["cancelled", "canceled", "incomplete_expired"].includes(status)) return "cancelled";
  if (["past_due", "unpaid"].includes(status)) return "past_due";
  return "other";
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  const normalized = String(value || "").trim().toLowerCase();
  return ["annual", "yearly", "year"].includes(normalized) ? "annual" : "monthly";
}

export function dateKeyInTimeZone(value: string | Date, timeZone = TRIAL_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function formatTrialDate(value: string | Date, timeZone = TRIAL_TIME_ZONE) {
  const key = dateKeyInTimeZone(value, timeZone);
  if (!key) return "Não disponível";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

export function trialDurationDays(
  trialStart: string | null | undefined,
  trialEnd: string | null | undefined,
) {
  if (!trialStart || !trialEnd) return null;
  const start = new Date(trialStart);
  const end = new Date(trialEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function trialDaysRemaining(trialEnd: string | null | undefined, now = new Date()) {
  if (!trialEnd) return null;
  const endKey = dateKeyInTimeZone(trialEnd);
  const nowKey = dateKeyInTimeZone(now);
  if (!endKey || !nowKey) return null;

  const toUtcDay = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.max(0, Math.ceil((toUtcDay(endKey) - toUtcDay(nowKey)) / 86_400_000));
}

export function trialPriceSummary(planName: unknown, billingCycleValue: unknown) {
  const planId = normalizePlanId(planName);
  if (!planId) return null;
  const billingCycle = normalizeBillingCycle(billingCycleValue);
  return {
    planId,
    billingCycle,
    price: getPlanPrice(planId, billingCycle),
    periodLabel: getPlanPeriodLabel(billingCycle),
  };
}
