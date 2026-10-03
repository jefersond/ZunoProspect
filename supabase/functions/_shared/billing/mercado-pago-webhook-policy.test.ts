import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateIntroPayment,
  isInitialSubscriptionAuthorization,
  isIntroRedemptionRedeemed,
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
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: plus(created, 4 * DAY + 10 * 60_000) }).ok)
      .toBe(true);
    expect(validateInitialAuthorization({ ...trialPlan, nextPaymentDate: plus(created, 4 * DAY + 20 * 60_000) }).ok)
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
    expect(preapprovalBlock).toContain('.select("trial_start,trial_end")');
    expect(preapprovalBlock).toContain("...(initialAuthorization ? {");
  });

  it("routes intro payments through the redemption-aware policy", () => {
    expect(webhook).toContain("evaluateIntroPayment(");
    expect(webhook).toContain('introDecision.kind === "redeem_intro"');
    expect(webhook).toContain('if (introDecision.kind === "reject") throw new Error(introDecision.error)');
  });
});
