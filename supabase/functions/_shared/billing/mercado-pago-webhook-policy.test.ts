import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateIntroPayment,
  isInitialSubscriptionAuthorization,
  isIntroRedemptionRedeemed,
  MP_TRIAL_OFFSET_MS,
  resolvePreapprovalLocalStatus,
  trialDurationWindow,
  validateInitialAuthorization,
} from "./mercado-pago-webhook-policy.ts";

const DAY = 86_400_000;
const created = "2026-10-01T12:00:00.000-03:00";
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

const trialPlan = {
  conversionPath: "trial" as const,
  expectedTrialDays: 4,
  expectedAmount: 47,
  providerPlanAmount: 47,
  providerTrial: { frequency: 4, frequency_type: "days" },
  dateCreated: created,
  nextPaymentDate: plus(created, 4 * DAY),
};

describe("Mercado Pago trial validation", () => {
  it("A. first authorization with a correct 4-day trial passes and anchors on date_created", () => {
    const session = { status: "ready", provider_subscription_id: null };
    expect(isInitialSubscriptionAuthorization(session, "sub_1")).toBe(true);
    const result = validateInitialAuthorization(trialPlan);
    expect(result).toEqual({ ok: true, trialStart: created, trialEnd: plus(created, 4 * DAY) });
  });

  it("B. first authorization with a wrong trial fails closed", () => {
    expect(validateInitialAuthorization({ ...trialPlan, providerTrial: { frequency: 7, frequency_type: "days" } }))
      .toEqual({ ok: false, error: "mercado_pago_trial_policy_mismatch" });
    expect(validateInitialAuthorization({ ...trialPlan, providerTrial: null }))
      .toEqual({ ok: false, error: "mercado_pago_trial_policy_mismatch" });
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: plus(created, 3 * DAY) }))
      .toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: null }))
      .toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(validateInitialAuthorization({ ...trialPlan, providerPlanAmount: 29.9 }))
      .toEqual({ ok: false, error: "mercado_pago_amount_mismatch" });
  });

  it("tolerates small provider clock skew on the initial trial window", () => {
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: plus(created, 4 * DAY - 10 * 60_000) }).ok)
      .toBe(true);
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: plus(created, 4 * DAY - 20 * 60_000) }).ok)
      .toBe(false);
  });

  it("a retry of a failed initial event is still validated (session not bound yet)", () => {
    expect(isInitialSubscriptionAuthorization({ status: "ready", provider_subscription_id: null }, "sub_1")).toBe(true);
    expect(isInitialSubscriptionAuthorization({ status: "failed", provider_subscription_id: null }, "sub_1")).toBe(true);
  });

  it("C. a later event with a different last_modified is not re-validated", () => {
    const boundSession = { status: "authorized", provider_subscription_id: "sub_1" };
    // last_modified moved and next_payment_date advanced: the old code would
    // have computed a non-4-day window here and cancelled the subscription.
    expect(isInitialSubscriptionAuthorization(boundSession, "sub_1")).toBe(false);
  });

  it("D. a later cancellation never reaches trial validation", () => {
    const boundSession = { status: "authorized", provider_subscription_id: "sub_1" };
    expect(isInitialSubscriptionAuthorization(boundSession, "sub_1")).toBe(false);
  });

  it("E. a later card/status update never reaches trial validation", () => {
    const boundSession = { status: "authorized", provider_subscription_id: "sub_1" };
    for (let i = 0; i < 3; i += 1) {
      expect(isInitialSubscriptionAuthorization(boundSession, "sub_1")).toBe(false);
    }
  });

  it("direct purchase must not carry a trial", () => {
    const direct = { ...trialPlan, conversionPath: "direct_purchase" as const, expectedTrialDays: 0 };
    expect(validateInitialAuthorization(direct))
      .toEqual({ ok: false, error: "mercado_pago_direct_purchase_has_trial" });
    expect(validateInitialAuthorization({ ...direct, providerTrial: null }))
      .toEqual({ ok: true, trialStart: null, trialEnd: null });
  });
});

describe("Mercado Pago intro offer payments", () => {
  const base = {
    introOfferApplied: true,
    introAmountCents: 2990,
    regularAmountCents: 4700,
    subscriptionId: "sub_1",
    invoiceId: "inv_1",
  };
  const claimed = { status: "claimed", redeemed_at: null, provider_subscription_id: null, provider_invoice_id: null };
  const redeemed = {
    status: "redeemed",
    redeemed_at: "2026-10-01T15:00:00Z",
    provider_subscription_id: "sub_1",
    provider_invoice_id: "inv_1",
  };

  it("A. first promotional payment at the right price redeems the intro", () => {
    expect(evaluateIntroPayment({ ...base, paidAmount: 29.9, redemption: claimed })).toEqual({ kind: "redeem_intro" });
  });

  it("B. first promotional payment at the wrong price fails", () => {
    expect(evaluateIntroPayment({ ...base, paidAmount: 47, redemption: claimed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_payment_amount_mismatch" });
    expect(evaluateIntroPayment({ ...base, paidAmount: 19.9, redemption: claimed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_payment_amount_mismatch" });
  });

  it("C. after redemption, a regular full-price renewal passes", () => {
    expect(evaluateIntroPayment({ ...base, invoiceId: "inv_2", paidAmount: 47, redemption: redeemed }))
      .toEqual({ kind: "regular_after_redemption" });
  });

  it("D. after redemption, a new promotional charge fails", () => {
    expect(evaluateIntroPayment({ ...base, invoiceId: "inv_2", paidAmount: 29.9, redemption: redeemed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_offer_already_redeemed" });
  });

  it("E. cancelling and re-subscribing does not restore the intro offer", () => {
    // New subscription sub_2 after sub_1 was cancelled; the lifetime redemption stays redeemed.
    expect(isIntroRedemptionRedeemed(redeemed)).toBe(true);
    expect(evaluateIntroPayment({ ...base, subscriptionId: "sub_2", invoiceId: "inv_9", paidAmount: 29.9, redemption: redeemed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_offer_already_redeemed" });
    expect(evaluateIntroPayment({ ...base, subscriptionId: "sub_2", invoiceId: "inv_9", paidAmount: 47, redemption: redeemed }))
      .toEqual({ kind: "regular_after_redemption" });
    // A redemption consumed through another provider also blocks the promo price.
    const stripeRedeemed = { status: "redeemed", redeemed_at: "2026-09-01T00:00:00Z", provider_subscription_id: "sub_stripe", provider_invoice_id: "in_x" };
    expect(evaluateIntroPayment({ ...base, paidAmount: 29.9, redemption: stripeRedeemed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_offer_already_redeemed" });
  });

  it("the same promotional charge delivered twice is idempotent, not a rejection", () => {
    expect(evaluateIntroPayment({ ...base, paidAmount: 29.9, redemption: redeemed }))
      .toEqual({ kind: "intro_already_recorded" });
  });

  it("rejects an unexpected amount after redemption", () => {
    expect(evaluateIntroPayment({ ...base, invoiceId: "inv_3", paidAmount: 50, redemption: redeemed }))
      .toEqual({ kind: "reject", error: "mercado_pago_regular_payment_amount_mismatch" });
  });

  it("rejects an invalid intro configuration and ignores non-intro subscriptions", () => {
    expect(evaluateIntroPayment({ ...base, regularAmountCents: 2990, paidAmount: 29.9, redemption: claimed }))
      .toEqual({ kind: "reject", error: "mercado_pago_intro_offer_config_invalid" });
    expect(evaluateIntroPayment({ ...base, introOfferApplied: false, paidAmount: 47, redemption: null }))
      .toEqual({ kind: "no_intro" });
  });
});

describe("Mercado Pago webhook wiring", () => {
  const webhook = readFileSync(resolve(process.cwd(), "supabase/functions/mercado-pago-webhook/index.ts"), "utf8");
  const preapprovalBlock = webhook.slice(
    webhook.indexOf('if (type === "subscription_preapproval")'),
    webhook.indexOf("let authorizedPayment"),
  );

  it("validates the trial and cancels remotely only inside the initial-authorization branch", () => {
    const initialBranch = preapprovalBlock.slice(
      preapprovalBlock.indexOf("if (initialAuthorization) {"),
      preapprovalBlock.indexOf("} else {"),
    );
    expect(initialBranch).toContain("validateInitialAuthorization(");
    expect(initialBranch).toContain('{ status: "canceled" }');
    expect(preapprovalBlock.match(/validateInitialAuthorization\(/g)).toHaveLength(1);
    // The only remote cancellations left in this block are provider-conflict guards
    // (enforceMpProvider lives outside it) and the initial-policy failure.
    expect(preapprovalBlock.match(/status: "canceled"/g)).toHaveLength(1);
  });

  it("binds the checkout session only after the policy passed and the trial window was persisted", () => {
    const bindAt = preapprovalBlock.indexOf('status: "authorized"');
    expect(preapprovalBlock.indexOf("validateInitialAuthorization(")).toBeLessThan(bindAt);
    expect(preapprovalBlock.indexOf("if (updateError) throw updateError;")).toBeLessThan(bindAt);
  });

  it("no longer derives trial dates from last_modified", () => {
    expect(webhook).not.toContain("last_modified");
  });

  it("reads trial dates from local state on later events and writes them only on the initial one", () => {
    expect(preapprovalBlock).toContain('.select("trial_start,trial_end,');
    expect(preapprovalBlock).toContain("...(initialAuthorization ? {");
  });

  it("routes intro payments through the redemption-aware policy", () => {
    expect(webhook).toContain("evaluateIntroPayment(");
    expect(webhook).toContain('introDecision.kind === "redeem_intro"');
    expect(webhook).toContain('if (introDecision.kind === "reject") throw new Error(introDecision.error)');
  });
});

describe("Mercado Pago preapproval status sync", () => {
  const later = { initialAuthorization: false, conversionPath: "trial" as const, inTrial: false };

  it("A. active subscription + normal authorized event stays active", () => {
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus: "active" }))
      .toEqual({ status: "active", kept: false });
  });

  it("B. past_due/unpaid subscription + new authorized preapproval does NOT become active", () => {
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus: "past_due" }))
      .toEqual({ status: "past_due", kept: true });
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus: "unpaid" }))
      .toEqual({ status: "unpaid", kept: true });
    expect(resolvePreapprovalLocalStatus({ ...later, conversionPath: "direct_purchase", providerStatus: "authorized", currentLocalStatus: "past_due" }))
      .toEqual({ status: "past_due", kept: true });
  });

  it("past_due can still be downgraded by the provider (cancel/pause)", () => {
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "cancelled", currentLocalStatus: "past_due" }))
      .toEqual({ status: "cancelled", kept: false });
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "paused", currentLocalStatus: "past_due" }))
      .toEqual({ status: "paused", kept: false });
  });

  it("D. cancelled subscription + later authorized event is NOT revived", () => {
    expect(resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus: "cancelled" }))
      .toEqual({ status: "cancelled", kept: true });
    expect(resolvePreapprovalLocalStatus({ ...later, inTrial: true, providerStatus: "authorized", currentLocalStatus: "cancelled" }))
      .toEqual({ status: "cancelled", kept: true });
  });

  it("E. the same event applied twice yields the same status (idempotent)", () => {
    for (const currentLocalStatus of ["active", "past_due", "cancelled", "trialing"]) {
      const first = resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus });
      const second = resolvePreapprovalLocalStatus({ ...later, providerStatus: "authorized", currentLocalStatus: first.status });
      expect(second.status).toBe(first.status);
    }
  });

  it("F. initial trial authorization still starts the trial, regardless of prior local state", () => {
    expect(resolvePreapprovalLocalStatus({ initialAuthorization: true, conversionPath: "trial", inTrial: true, providerStatus: "authorized", currentLocalStatus: "free" }))
      .toEqual({ status: "trialing", kept: false });
    expect(resolvePreapprovalLocalStatus({ initialAuthorization: true, conversionPath: "trial", inTrial: true, providerStatus: "authorized", currentLocalStatus: null }))
      .toEqual({ status: "trialing", kept: false });
    // A later event during the trial keeps it trialing.
    expect(resolvePreapprovalLocalStatus({ ...later, inTrial: true, providerStatus: "authorized", currentLocalStatus: "trialing" }))
      .toEqual({ status: "trialing", kept: false });
  });

  it("G. direct purchase / intro offer: incomplete until paid, and a later event does not demote active", () => {
    expect(resolvePreapprovalLocalStatus({ initialAuthorization: true, conversionPath: "direct_purchase", inTrial: false, providerStatus: "authorized", currentLocalStatus: null }))
      .toEqual({ status: "incomplete", kept: false });
    expect(resolvePreapprovalLocalStatus({ ...later, conversionPath: "direct_purchase", providerStatus: "authorized", currentLocalStatus: "active" }))
      .toEqual({ status: "active", kept: true });
  });
});

describe("Mercado Pago past_due recovery path", () => {
  const webhook = readFileSync(resolve(process.cwd(), "supabase/functions/mercado-pago-webhook/index.ts"), "utf8");
  const preapprovalBlock = webhook.slice(
    webhook.indexOf('if (type === "subscription_preapproval")'),
    webhook.indexOf("let authorizedPayment"),
  );
  const paymentBlock = webhook.slice(webhook.indexOf("let authorizedPayment"));

  it("C. only an approved payment sets active; the preapproval block derives status from the resolver", () => {
    expect(preapprovalBlock).toContain("resolvePreapprovalLocalStatus(");
    expect(preapprovalBlock).toContain("subscription_status: localStatus");
    expect(preapprovalBlock).not.toContain('subscription_status: "active"');
    const approvedAt = paymentBlock.indexOf("if (approved)");
    const activeAt = paymentBlock.indexOf('subscription_status: "active"');
    const rejectedAt = paymentBlock.indexOf("} else if (rejected)");
    expect(approvedAt).toBeGreaterThan(-1);
    expect(activeAt).toBeGreaterThan(approvedAt);
    expect(activeAt).toBeLessThan(rejectedAt);
  });

  it("reads the current local status before resolving a later event", () => {
    expect(preapprovalBlock).toContain('.select("trial_start,trial_end,subscription_status,status,canceled_at")');
  });

  it("keeps the original canceled_at when a cancelled subscription receives another event", () => {
    expect(preapprovalBlock).toContain("alreadyCancelledLocally && localBefore?.canceled_at ? localBefore.canceled_at");
  });
});

describe("Mercado Pago trial window from real TEST subscriptions", () => {
  const HOUR = 3_600_000;
  const MIN = 60_000;
  // Real MP TEST preapprovals (seller 3716084566): date_created / next_payment_date as returned by the API.
  const realSamples = [
    { id: "c422ac3907034570810d57869c3bf595", created: "2026-10-03T14:30:41.000-04:00", next: "2026-10-07T18:27:07.000-04:00" },
    { id: "55eded2f13ba4d52a52f6bb4e6437040", created: "2026-09-27T21:45:36.000-04:00", next: "2026-10-02T01:44:36.000-04:00" },
    { id: "2326182abb40465aa99edb14c75f1464", created: "2026-09-27T21:39:45.000-04:00", next: "2026-10-02T01:35:16.000-04:00" },
    { id: "0e418a876ca74d029f031b1bfe20c25b", created: "2026-09-27T21:46:40.000-04:00", next: "2026-10-02T01:44:36.000-04:00" },
    { id: "b12019669a00448493a3c0fcf3a86ccd", created: "2026-09-27T21:36:47.000-04:00", next: "2026-10-02T01:35:16.000-04:00" },
  ];
  const at = (created: string, next: string | null) =>
    validateInitialAuthorization({ ...trialPlan, dateCreated: created, nextPaymentDate: next });

  it("documents a bounded window: 4 days -15min up to 4 days +4h +15min", () => {
    expect(MP_TRIAL_OFFSET_MS).toBe(4 * HOUR);
    expect(trialDurationWindow(4)).toEqual({ minMs: 4 * DAY - 15 * MIN, maxMs: 4 * DAY + 4 * HOUR + 15 * MIN });
  });

  it("A. exactly date_created + 4 days passes", () => {
    expect(at(created, plus(created, 4 * DAY))).toEqual({ ok: true, trialStart: created, trialEnd: plus(created, 4 * DAY) });
  });

  it("B. real observed case (4 days + ~3h56min) passes", () => {
    const real = realSamples[0];
    expect(at(real.created, real.next)).toEqual({ ok: true, trialStart: real.created, trialEnd: real.next });
  });

  it("C. every real sample passes and lies inside the window", () => {
    const window = trialDurationWindow(4);
    for (const sample of realSamples) {
      const duration = Date.parse(sample.next) - Date.parse(sample.created);
      expect(duration).toBeGreaterThanOrEqual(window.minMs);
      expect(duration).toBeLessThanOrEqual(window.maxMs);
      expect(at(sample.created, sample.next).ok).toBe(true);
    }
  });

  it("D. a 3-day interval fails closed", () => {
    expect(at(created, plus(created, 3 * DAY))).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
  });

  it("E. 5 days, or anything past 4 days +4h15min, fails closed", () => {
    expect(at(created, plus(created, 5 * DAY))).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(at(created, plus(created, 4 * DAY + 4 * HOUR + 16 * MIN)).ok).toBe(false);
    expect(at(created, plus(created, 4 * DAY + 4 * HOUR + 15 * MIN)).ok).toBe(true);
    expect(at(created, plus(created, 4 * DAY + 6 * HOUR)).ok).toBe(false);
  });

  it("F. next_payment_date before date_created fails closed", () => {
    expect(at(created, plus(created, -60 * MIN))).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(at(created, created)).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
  });

  it("G. missing or invalid date_created / next_payment_date fails closed", () => {
    expect(validateInitialAuthorization({ ...trialPlan, dateCreated: null })).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(validateInitialAuthorization({ ...trialPlan, dateCreated: "not-a-date" })).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
    expect(at(created, null)).toEqual({ ok: false, error: "mercado_pago_trial_end_mismatch" });
  });

  it("still requires the plan to carry a 4-day trial", () => {
    const real = realSamples[0];
    expect(validateInitialAuthorization({ ...trialPlan, dateCreated: real.created, nextPaymentDate: real.next, providerTrial: { frequency: 5, frequency_type: "days" } }))
      .toEqual({ ok: false, error: "mercado_pago_trial_policy_mismatch" });
  });

  it("H/I. later events (incl. cancellation) never reach trial validation", () => {
    const bound = { status: "authorized", provider_subscription_id: realSamples[0].id };
    expect(isInitialSubscriptionAuthorization(bound, realSamples[0].id)).toBe(false);
  });
});
