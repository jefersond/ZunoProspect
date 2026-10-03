/**
 * Pure decision logic for the Mercado Pago webhook.
 *
 * Kept free of Deno/Supabase APIs so it can be unit tested with Vitest and
 * reused by the Edge Function without changing behavior.
 */

export const TRIAL_DATE_TOLERANCE_MS = 15 * 60_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Mercado Pago does not set next_payment_date to exactly date_created + trial.
 *
 * Observed behavior: 5 real TEST subscriptions (seller 3716084566, MLB,
 * 2026-09-27 and 2026-10-03) showed next_payment_date between
 * trial + 3h55m31s and trial + 3h59m00s after date_created.
 *
 * The exact cause of this provider-side skew is still unknown; it is NOT
 * assumed here to be a timezone effect. The extra allowance is a bounded
 * tolerance derived only from that observed behavior.
 *
 * The initial authorization therefore accepts a duration in
 *   [trial - TRIAL_DATE_TOLERANCE_MS, trial + MP_TRIAL_MAX_PROVIDER_SKEW_MS + TRIAL_DATE_TOLERANCE_MS]
 * i.e. [trial - 15min, trial + 4h15min]; for a 4-day trial, from 3d23h45m up
 * to 4d04h15m. Anything outside the window, missing/invalid dates, or
 * next_payment_date <= date_created keeps failing closed.
 */
export const MP_TRIAL_MAX_PROVIDER_SKEW_MS = 4 * HOUR_MS;

export function trialDurationWindow(expectedTrialDays: number) {
  const expectedMs = expectedTrialDays * DAY_MS;
  return {
    minMs: expectedMs - TRIAL_DATE_TOLERANCE_MS,
    maxMs: expectedMs + MP_TRIAL_MAX_PROVIDER_SKEW_MS + TRIAL_DATE_TOLERANCE_MS,
  };
}

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
  const window = trialDurationWindow(input.expectedTrialDays);
  const datesOk = Number.isFinite(durationMs)
    && durationMs > 0
    && durationMs >= window.minMs
    && durationMs <= window.maxMs;
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

/**
 * Local states that may only be left through the approved-payment path
 * (payment / subscription_authorized_payment webhook), never by a bare
 * subscription_preapproval event. Reuses the states the webhook already writes.
 */
export const PAYMENT_FAILURE_LOCAL_STATUSES = ["past_due", "unpaid"] as const;

export function isProviderCancelledStatus(status: string | null | undefined): boolean {
  return status === "canceled" || status === "cancelled";
}

export type PreapprovalStatusInput = {
  initialAuthorization: boolean;
  providerStatus: string;
  conversionPath: "trial" | "direct_purchase";
  inTrial: boolean;
  /** Current local subscription_status (or status) before this event. */
  currentLocalStatus: string | null | undefined;
};

export type PreapprovalStatusResult = {
  status: string;
  /** True when the local status was intentionally kept instead of upgraded. */
  kept: boolean;
};

/**
 * Maps a subscription_preapproval event to the local status.
 * A later preapproval event can downgrade (cancel/pause) but can never, by
 * itself, revive a subscription that is locally cancelled or in a payment
 * failure state: that requires an approved payment.
 */
export function resolvePreapprovalLocalStatus(input: PreapprovalStatusInput): PreapprovalStatusResult {
  const providerCancelled = isProviderCancelledStatus(input.providerStatus);
  if (providerCancelled) return { status: "cancelled", kept: false };

  const current = String(input.currentLocalStatus || "").toLowerCase();
  if (!input.initialAuthorization) {
    if (isProviderCancelledStatus(current)) return { status: "cancelled", kept: true };
    if (
      (PAYMENT_FAILURE_LOCAL_STATUSES as readonly string[]).includes(current)
      && input.providerStatus === "authorized"
    ) {
      return { status: current, kept: true };
    }
  }

  if (input.inTrial) return { status: "trialing", kept: false };
  if (input.conversionPath === "direct_purchase" && input.providerStatus === "authorized") {
    // Direct purchase stays incomplete until the approved payment arrives;
    // a later event must not demote an already active subscription.
    if (!input.initialAuthorization && current === "active") return { status: "active", kept: true };
    return { status: "incomplete", kept: false };
  }
  if (input.providerStatus === "authorized") return { status: "active", kept: false };
  return { status: input.providerStatus, kept: false };
}
