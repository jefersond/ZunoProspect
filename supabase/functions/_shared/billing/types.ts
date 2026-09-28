import type { BillingCycle, BillingPlanId } from "./catalog.ts";

export type BillingProviderName = "stripe" | "mercado_pago";
export type BillingConversionPath = "trial" | "direct_purchase";

export type IntroOfferPlanConfig = {
  intro_amount_cents: number;
  regular_amount_cents: number;
  stripe_coupon_id?: string | null;
};

export type BillingProviderConfig = {
  default_new_billing_provider: BillingProviderName;
  stripe_trial_duration_days: number;
  stripe_trial_policy_version: string;
  mercado_pago_trial_duration_days: number;
  mercado_pago_trial_policy_version: string;
  mercado_pago_cutover_ready: boolean;
  intro_offer_enabled: boolean;
  intro_offer_key: string;
  intro_offer_duration: "first_billing_period";
  intro_offer_plans: Partial<Record<BillingPlanId, IntroOfferPlanConfig>>;
};

export type BillingCheckoutInput = {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  source?: string | null;
  offerId?: string | null;
  conversionPath?: BillingConversionPath;
};

export type BillingCheckoutResult = {
  provider: BillingProviderName;
  url: string;
  checkoutId?: string | null;
  trialDurationDays: number;
  trialPolicyVersion: string;
  conversionPath: BillingConversionPath;
  introOfferApplied: boolean;
  introOfferKey?: string | null;
  introPrice?: number | null;
  regularPrice?: number | null;
};

export interface BillingProviderAdapter {
  readonly provider: BillingProviderName;
  createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult>;
}
