import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Mercado Pago hybrid billing readiness", () => {
  const adapter = source("supabase/functions/_shared/billing/mercado-pago-adapter.ts");
  const router = source("supabase/functions/create-billing-checkout/index.ts");
  const webhook = source("supabase/functions/mercado-pago-webhook/index.ts");
  const webhookPolicy = source("supabase/functions/_shared/billing/mercado-pago-webhook-policy.ts");
  const manage = source("supabase/functions/manage-billing-subscription/index.ts");
  const offerConfig = source("supabase/functions/billing-offer-config/index.ts");
  const catalog = source("supabase/functions/_shared/billing/catalog.ts");
  const directMigration = source("supabase/migrations/20260927235544_mercado_pago_direct_purchase.sql");
  const identityMigration = source("supabase/migrations/20260928004500_mercado_pago_checkout_identity.sql");
  const introMigration = source("supabase/migrations/20260927231000_all_plans_intro_offer.sql");

  it("keeps Mercado Pago trial at the provider-configured duration and regular price", () => {
    expect(router).toContain("typedConfig.mercado_pago_trial_duration_days");
    expect(adapter).toContain('conversionPath === "trial" ? this.trialDurationDays : 0');
    expect(adapter).toContain("autoRecurring.free_trial");
    expect(adapter).toContain("transaction_amount: transactionAmount");
    expect(catalog).toContain('starter: { displayName: "Starter", monthlyAmount: 47');
  });

  it("creates direct purchase without a trial", () => {
    expect(adapter).toContain('conversionPath !== "direct_purchase"');
    expect(adapter).toContain('if (conversionPath === "trial")');
    expect(webhookPolicy).toContain('"mercado_pago_direct_purchase_has_trial"');
    expect(directMigration).toContain("(conversion_path = 'direct_purchase' and trial_duration_days = 0)");
  });

  it("uses canonical all-plan intro offer values", () => {
    expect(introMigration).toContain("'intro_amount_cents', 2990");
    expect(introMigration).toContain("'regular_amount_cents', 4700");
    expect(introMigration).toContain("'intro_amount_cents', 5990");
    expect(introMigration).toContain("'regular_amount_cents', 9700");
    expect(introMigration).toContain("'intro_amount_cents', 15990");
    expect(introMigration).toContain("'regular_amount_cents', 24700");
    expect(adapter).toContain("this.config.intro_offer_plans?.[input.planId]");
    expect(offerConfig).toContain("intro_offer_plans");
  });

  it("applies intro only to first payment then switches recurrence to regular price", () => {
    expect(adapter).toContain("transactionAmount = intro.applied ? intro.introAmount : regularAmount");
    expect(webhookPolicy).toContain("mercado_pago_intro_payment_amount_mismatch");
    expect(webhookPolicy).toContain("mercado_pago_intro_offer_already_redeemed");
    expect(webhook).toContain("mercado_pago_regular_price_update_mismatch");
    expect(webhook).toContain("transaction_amount: regularAmount");
    expect(webhook).toContain('status: "redeemed"');
    expect(webhook).toContain("redeemed_at");
  });

  it("preserves one intro offer lifetime globally", () => {
    expect(introMigration).toContain("billing_intro_offer_one_lifetime_per_user");
    expect(introMigration).toContain("billing_intro_offer_redemptions(user_id)");
    expect(adapter).toContain('.eq("user_id", this.userId)');
    expect(adapter).toContain('existing?.status === "redeemed"');
  });

  it("separates trial and direct checkout identities for retry safety", () => {
    expect(identityMigration).toContain("mercado_pago_checkout_sessions_checkout_identity_unique");
    expect(identityMigration).toContain("conversion_path");
    expect(adapter).toContain('.eq("conversion_path", conversionPath)');
    expect(adapter).toContain('"mercado_pago_checkout_in_progress"');
  });

  it("keeps provider lock and protects existing Stripe relationships", () => {
    expect(router).toContain("claim_billing_provider");
    expect(router).toContain("stripe_customer_id");
    expect(webhook).toContain("stripe_relationship_exists");
    expect(webhook).toContain("duplicate_mercado_pago_subscription");
  });

  it("does not count an authorized direct subscription as paid before provider payment", () => {
    expect(webhookPolicy).toContain('return { status: "incomplete", kept: false }');
    expect(webhook).toContain('if (approved)');
    expect(webhook).toContain('"purchase_completed"');
  });

  it("keeps webhook signature validation and provider-event idempotency", () => {
    expect(webhook).toContain("validateSignature");
    expect(webhook).toContain('"invalid_signature"');
    expect(webhook).toContain("401");
    expect(webhook).toContain('onConflict: "provider,provider_event_id"');
    expect(webhook).toContain("seen.status === \"processed\"");
  });

  it("maps approved, rejected, trial, active and cancelled states", () => {
    expect(webhook).toContain('paymentStatus === "approved"');
    expect(webhook).toContain('paymentStatus === "rejected"');
    expect(webhook).toContain('"past_due"');
    expect(webhook).toContain('"trialing"');
    expect(webhook).toContain('"active"');
    expect(webhook).toContain('"cancelled"');
  });

  it("syncs local cancellation without restoring intro redemption", () => {
    expect(manage).toContain('body: JSON.stringify({ status: "canceled" })');
    expect(manage).toContain('subscription_status: "cancelled"');
    expect(manage).not.toContain("billing_intro_offer_redemptions");
  });

  it("tags analytics with provider and conversion path", () => {
    expect(webhook).toContain('billing_provider: "mercado_pago"');
    expect(webhook).toContain("conversion_path:");
    expect(webhook).toContain("intro_offer_price:");
    expect(webhook).toContain("regular_price:");
  });

  it("does not enable cutover in code", () => {
    expect(router).toContain("mercado_pago_cutover_not_ready");
    expect(router).toContain("mercado_pago_cutover_ready");
  });
});
