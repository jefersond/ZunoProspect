export type BillingPlanId = "starter" | "pro" | "agency";
export type BillingCycle = "monthly" | "annual";

export const BILLING_CATALOG: Record<BillingPlanId, {
  displayName: string;
  monthlyAmount: number;
  annualAmount: number;
}> = {
  starter: { displayName: "Starter", monthlyAmount: 47, annualAmount: 470 },
  pro: { displayName: "Pro", monthlyAmount: 97, annualAmount: 970 },
  agency: { displayName: "Agency", monthlyAmount: 247, annualAmount: 2470 },
};

export function billingAmount(planId: BillingPlanId, billingCycle: BillingCycle) {
  return billingCycle === "annual"
    ? BILLING_CATALOG[planId].annualAmount
    : BILLING_CATALOG[planId].monthlyAmount;
}

export function billingFrequencyMonths(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? 12 : 1;
}
