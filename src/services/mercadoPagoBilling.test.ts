import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Mercado Pago hybrid billing safety", () => {
  const checkoutRouter = source("supabase/functions/create-billing-checkout/index.ts");
  const adapter = source("supabase/functions/_shared/billing/mercado-pago-adapter.ts");
  const webhook = source("supabase/functions/mercado-pago-webhook/index.ts");
  const manage = source("supabase/functions/manage-billing-subscription/index.ts");
  const config = source("supabase/functions/billing-offer-config/index.ts");
  const hybridMigration = source("supabase/migrations/20260924230000_hybrid_billing_mercado_pago.sql");
  const introMigration = source("supabase/migrations/20260927231000_all_plans_intro_offer.sql");
  const directMigration = source("supabase/migrations/20260927235000_mercado_pago_direct_purchase.sql");
  const reconciliation = source("supabase/migrations/20260927234000_stripe_state_reconciliation.sql");

  it("keeps Mercado Pago cutover disabled by default while preserving 4-day trial", () => {
    expect(hybridMigration).toContain("mercado_pago_trial_duration_days integer not null default 4");
    expect(hybridMigration).toContain("mercado_pago_cutover_ready boolean not null default false");
    expect(checkoutRouter).toContain("mercado_pago_cutover_not_ready");
  });

  it("keeps provider lock and Stripe relationship guard intact", () => {
    expect(hybridMigration).toContain("claim_billing_provider");
    expect(hybridMigration).toContain("billing_provider_locked");
    expect(webhook).toContain("stripe_relationship_exists");
    expect(webhook).toContain("duplicate_mercado_pago_subscription");
  });

  it("supports trial and direct purchase as separate Mercado Pago paths", () => {
    expect(adapter).toContain('const directPurchase = conversionPath === "direct_purchase"');
    expect(adapter).toContain('trialDurationDays = directPurchase ? 0 : this.trialDurationDays');
    expect(adapter).toContain("if (!directPurchase)");
    expect(adapter).toContain("autoRecurring.free_trial");
    expect(webhook).toContain("mercado_pago_direct_purchase_has_trial");
    expect(directMigration).toContain("conversion_path in ('trial','direct_purchase')");
  });

  it("uses canonical intro offer prices for all plans", () => {
    expect(introMigration).toContain("'intro_amount_cents', 2990");
    expect(introMigration).toContain("'regular_amount_cents', 4700");
    expect(introMigration).toContain("'intro_amount_cents', 5990");
    expect(introMigration).toContain("'regular_amount_cents', 9700");
    expect(introMigration).toContain("'intro_amount_cents', 15990");
    expect(introMigration).toContain("'regular_amount_cents', 24700");
    expect(adapter).toContain("this.introOffer.plans[input.planId]");
  });

  it("uses one global intro redemption per canonical user", () => {
    expect(adapter).toContain('.from("billing_intro_offer_redemptions")');
    expect(adapter).toContain('.eq("user_id", this.userId)');
    expect(webhook).toContain("intro_offer_redemption_context_missing");
    expect(webhook).toContain('status: "redeemed"');
    expect(introMigration).toContain("billing_intro_offer_one_lifetime_per_user");
  });

  it("switches recurring amount to regular only after approved direct intro payment", () => {
    expect(webhook).toContain('if (conversionPath === "direct_purchase" && introOfferApplied)');
    expect(webhook).toContain("mercado_pago_intro_payment_amount_mismatch");
    expect(webhook).toContain("transaction_amount: regularPrice");
    expect(webhook).toContain("mercado_pago_regular_amount_update_failed");
    expect(webhook).toContain("intro_offer_redemption_persist_failed");
  });

  it("does not count preapproval creation as paid", () => {
    expect(webhook).toContain('const localStatus = cancelled');
    expect(webhook).toContain(': "incomplete"');
    expect(webhook).toContain('if (approved)');
    expect(webhook).toContain('payment_status: "paid"');
    expect(webhook).toContain('subscription_status: "active"');
    expect(webhook).toContain("if (!directPurchase)");
    expect(webhook).toContain("preapprovalUpdate.plan_name = planRow.plan_id");
    expect(webhook).toContain("const paidEntitlements = BILLING_CATALOG");
  });

  it("maps rejected payment to past_due and canonical failure analytics", () => {
    expect(webhook).toContain('payment_status: "failed"');
    expect(webhook).toContain('subscription_status: "past_due"');
    expect(webhook).toContain('"payment_failed"');
    expect(webhook).toContain("canonicalFailureReason");
  });

  it("keeps webhook signature validation and provider event dedupe", () => {
    expect(webhook).toContain('return json({ error: "invalid_signature" }, 401)');
    expect(webhook).toContain('.eq("provider", "mercado_pago")');
    expect(webhook).toContain('.eq("provider_event_id", eventId)');
    expect(webhook).toContain('if (seen?.id && seen.status === "processed")');
    expect(webhook).toContain('onConflict: "provider,provider_event_id"');
  });

  it("keeps cancellation on Mercado Pago provider API", () => {
    expect(manage).toContain("mercado_pago_subscription_id");
    expect(manage).toContain('body: JSON.stringify({ status: "canceled" })');
  });

  it("makes frontend offer eligibility provider agnostic", () => {
    expect(config).toContain("eligible: introOfferEligible");
    expect(config).not.toContain('eligibilityReason: provider === "stripe" ? introOfferEligibilityReason : "stripe_only"');
  });

  it("adds idempotent audited Stripe mirror reconciliation without writing Stripe", () => {
    expect(reconciliation).toContain("billing_reconciliation_audit");
    expect(reconciliation).toContain("reconcile_stripe_subscription_states");
    expect(reconciliation).toContain("subscription_status = v_local_status");
    expect(reconciliation).not.toContain("api.stripe.com");
  });
});
