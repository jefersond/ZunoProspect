import type { BillingCycle, BillingPlanId } from "./catalog.ts";

export type BillingProviderName = "stripe" | "mercado_pago";
export type BillingConversionPath = "trial" | "direct_purchase";

export type BillingProviderConfig = {
  default_new_billing_provider: BillingProviderName;
  stripe_trial_duration_days: number;
  stripe_trial_policy_version: string;
  mercado_pago_trial_duration_days: number;
  mercado_pago_trial_policy_version: string;
  mercado_pago_cutover_ready: boolean;
  starter_intro_offer_enabled: boolean;
  starter_intro_offer_key: string;
  starter_intro_offer_plan_id: "starter";
  starter_intro_offer_billing_cycle: "monthly";
  starter_intro_offer_conversion_path: "direct_purchase";
  starter_intro_offer_intro_amount_cents: number;
  starter_intro_offer_regular_amount_cents: number;
  starter_intro_offer_duration: "first_billing_period";
  stripe_starter_intro_coupon_id: string | null;
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
