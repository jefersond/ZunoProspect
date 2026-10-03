/**
 * Pure decision logic for the Mercado Pago webhook.
 *
 * Kept free of Deno/Supabase APIs so it can be unit tested with Vitest and
 * reused by the Edge Function without changing behavior.
 */

export const TRIAL_DATE_TOLERANCE_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

export type CheckoutSessionLike = {
  status?: string | null;
  provider_subscription_id?: string | null;
};

/**
 * A subscription_preapproval event is the "initial authorization" until the
 * checkout session has been bound to this exact subscription as authorized.
 * The session is only bound after the initial policy checks pass, so a retry
 * of a failed initial event is still validated (fail-closed), while any later
 * event (cancellation, card update, post-trial status change) is not.
 */
export function isInitialSubscriptionAuthorization(
  session: CheckoutSessionLike,
  incomingSubscriptionId: string,
): boolean {
  return !(
    session.status === "authorized"
    && Boolean(session.provider_subscription_id)
    && session.provider_subscription_id === incomingSubscriptionId
  );
}

export type ProviderFreeTrial = {
  frequency?: number | string | null;
  frequency_type?: string | null;
} | null | undefined;

export type InitialAuthorizationInput = {
  conversionPath: "trial" | "direct_purchase";
  expectedTrialDays: number;
  expectedAmount: number;
  providerPlanAmount: number;
  providerTrial: ProviderFreeTrial;
  dateCreated: string | null | undefined;
  nextPaymentDate: string | null | undefined;
};

export type InitialAuthorizationError =
  | "mercado_pago_amount_mismatch"
  | "mercado_pago_trial_policy_mismatch"
  | "mercado_pago_trial_end_mismatch"
  | "mercado_pago_direct_purchase_has_trial";

export type InitialAuthorizationResult =
  | { ok: true; trialStart: string | null; trialEnd: string | null }
  | { ok: false; error: InitialAuthorizationError };

/**
 * Fail-closed checks that only make sense when the subscription is first
 * authorized. Trial start is the provider's date_created (immutable), trial
 * end is the first next_payment_date.
 */
export function validateInitialAuthorization(input: InitialAuthorizationInput): InitialAuthorizationResult {
  if (Math.abs(Number(input.providerPlanAmount || 0) - Number(input.expectedAmount || 0)) > 0.001) {
    return { ok: false, error: "mercado_pago_amount_mismatch" };
  }

  if (input.conversionPath === "direct_purchase") {
    if (input.providerTrial) return { ok: false, error: "mercado_pago_direct_purchase_has_trial" };
    return { ok: true, trialStart: null, trialEnd: null };
  }

  const providerTrial = input.providerTrial;
  const providerTrialOk = Boolean(providerTrial)
    && Number(providerTrial?.frequency) === input.expectedTrialDays
    && providerTrial?.frequency_type === "days";
  if (!providerTrialOk) return { ok: false, error: "mercado_pago_trial_policy_mismatch" };

  const trialStart = input.dateCreated ? String(input.dateCreated) : null;
  const trialEnd = input.nextPaymentDate ? String(input.nextPaymentDate) : null;
  const startMs = trialStart ? Date.parse(trialStart) : NaN;
  const endMs = trialEnd ? Date.parse(trialEnd) : NaN;
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : NaN;
  const datesOk = Number.isFinite(durationMs)
    && Math.abs(durationMs - input.expectedTrialDays * DAY_MS) <= TRIAL_DATE_TOLERANCE_MS;
  if (!datesOk) return { ok: false, error: "mercado_pago_trial_end_mismatch" };

  return { ok: true, trialStart, trialEnd };
}

export type IntroRedemptionLike = {
  status?: string | null;
  redeemed_at?: string | null;
  provider_subscription_id?: string | null;
  provider_invoice_id?: string | null;
} | null | undefined;

export function isIntroRedemptionRedeemed(redemption: IntroRedemptionLike): boolean {
  return Boolean(redemption?.redeemed_at) || redemption?.status === "redeemed";
}

export type IntroPaymentInput = {
  introOfferApplied: boolean;
  introAmountCents: number | null | undefined;
  regularAmountCents: number | null | undefined;
  paidAmount: number;
  redemption: IntroRedemptionLike;
  subscriptionId: string;
  invoiceId: string;
};

export type IntroPaymentRejection =
  | "mercado_pago_intro_offer_config_invalid"
  | "mercado_pago_intro_payment_amount_mismatch"
  | "mercado_pago_intro_offer_already_redeemed"
  | "mercado_pago_regular_payment_amount_mismatch";

export type IntroPaymentDecision =
  /** Subscription was not sold with an intro offer: nothing to enforce here. */
  | { kind: "no_intro" }
  /** First promotional charge: switch recurrence to the regular price and redeem. */
  | { kind: "redeem_intro" }
  /** Same promotional charge delivered again (retry / second topic): already handled. */
  | { kind: "intro_already_recorded" }
  /** Recurring charge at the regular price after the intro was redeemed. */
  | { kind: "regular_after_redemption" }
  | { kind: "reject"; error: IntroPaymentRejection };

/**
 * Decides how an approved payment on an intro-offer subscription is handled.
 * The promotional price is accepted only while the user's lifetime redemption
 * is not yet redeemed; afterwards only the regular price is accepted.
 */
export function evaluateIntroPayment(input: IntroPaymentInput): IntroPaymentDecision {
  if (!input.introOfferApplied) return { kind: "no_intro" };

  const introCents = Number(input.introAmountCents || 0);
  const regularCents = Number(input.regularAmountCents || 0);
  if (introCents <= 0 || regularCents <= introCents) {
    return { kind: "reject", error: "mercado_pago_intro_offer_config_invalid" };
  }

  const paidCents = Math.round(Number(input.paidAmount || 0) * 100);

  if (!isIntroRedemptionRedeemed(input.redemption)) {
    return paidCents === introCents
      ? { kind: "redeem_intro" }
      : { kind: "reject", error: "mercado_pago_intro_payment_amount_mismatch" };
  }

  const redemption = input.redemption;
  const sameInvoice = Boolean(redemption?.provider_invoice_id)
    && redemption?.provider_invoice_id === input.invoiceId
    && (!redemption?.provider_subscription_id || redemption.provider_subscription_id === input.subscriptionId);
  if (sameInvoice && paidCents === introCents) return { kind: "intro_already_recorded" };

  if (paidCents === regularCents) return { kind: "regular_after_redemption" };
  if (paidCents === introCents) return { kind: "reject", error: "mercado_pago_intro_offer_already_redeemed" };
  return { kind: "reject", error: "mercado_pago_regular_payment_amount_mismatch" };
}
