export type BillingProviderName = "stripe" | "mercado_pago";
export type BillingCycle = "monthly" | "annual";
export type PlanId = "starter" | "pro" | "agency";

export const STRIPE_LEGACY_TRIAL_DURATION_DAYS = 7;
export const STRIPE_LEGACY_TRIAL_POLICY_VERSION = "stripe_legacy_7d";
export const MERCADO_PAGO_TRIAL_DURATION_DAYS = 4;
export const MERCADO_PAGO_TRIAL_POLICY_VERSION = "4d_2026_09";

export const BILLING_PLANS = {
  starter: { name: "Starter", monthlyPrice: 47, annualPrice: 470, leadsLimit: 300, aiLimit: 30 },
  pro: { name: "Pro", monthlyPrice: 97, annualPrice: 970, leadsLimit: 800, aiLimit: 100 },
  agency: { name: "Agency", monthlyPrice: 247, annualPrice: 2470, leadsLimit: 2000, aiLimit: 300 },
} as const;

export function normalizePlanId(value: unknown): PlanId | null {
  const key = String(value || "").trim().toLowerCase();
  if (key === "iniciante") return "starter";
  if (key === "agencia" || key === "agência") return "agency";
  if (key === "starter" || key === "pro" || key === "agency") return key;
  return null;
}

export function normalizeBillingCycle(value: unknown): BillingCycle | null {
  const key = String(value || "").trim().toLowerCase();
  return key === "monthly" || key === "annual" ? key : null;
}

export function planAmount(planId: PlanId, billingCycle: BillingCycle) {
  const plan = BILLING_PLANS[planId];
  return billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

export function canonicalSubscriptionStatus(provider: BillingProviderName, status: unknown) {
  const value = String(status || "").toLowerCase();
  if (provider === "stripe") {
    if (value === "trialing") return "trialing";
    if (value === "active") return "active";
    if (["past_due","unpaid"].includes(value)) return "past_due";
    if (["canceled","cancelled","incomplete_expired"].includes(value)) return "cancelled";
    return value || "unknown";
  }

  if (value === "authorized") return "active";
  if (value === "pending") return "trialing";
  if (value === "paused") return "past_due";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return value || "unknown";
}
