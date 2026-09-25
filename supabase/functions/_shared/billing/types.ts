import type { BillingCycle, BillingPlanId } from "./catalog.ts";

export type BillingProviderName = "stripe" | "mercado_pago";

export type BillingProviderConfig = {
  default_new_billing_provider: BillingProviderName;
  stripe_trial_duration_days: number;
  stripe_trial_policy_version: string;
  mercado_pago_trial_duration_days: number;
  mercado_pago_trial_policy_version: string;
  mercado_pago_cutover_ready: boolean;
};

export type BillingCheckoutInput = {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  source?: string | null;
  offerId?: string | null;
};

export type BillingCheckoutResult = {
  provider: BillingProviderName;
  url: string;
  checkoutId?: string | null;
  trialDurationDays: number;
  trialPolicyVersion: string;
};

export interface BillingProviderAdapter {
  readonly provider: BillingProviderName;
  createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult>;
}
