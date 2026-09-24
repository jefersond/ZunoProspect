import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { trialDurationDays } from "@/lib/trialActivation";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("hybrid Stripe + Mercado Pago billing policy", () => {
  const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");
  const stripeWebhook = source("supabase/functions/stripe-webhook/index.ts");
  const trackEvent = source("supabase/functions/track-event/index.ts");
  const mpAdapter = source("supabase/functions/_shared/billing/mercado-pago-adapter.ts");
  const mpWebhook = source("supabase/functions/mercado-pago-webhook/index.ts");
  const billingRouter = source("supabase/functions/create-billing-checkout/index.ts");
  const migration = source("supabase/migrations/20260924230000_hybrid_billing_mercado_pago.sql");
  const offerHook = source("src/hooks/useBillingOfferConfig.ts");

  it("preserves the Stripe baseline trial at seven days", () => {
    expect(stripeCheckout).toContain("trial_period_days: 7");
    expect(trialDurationDays("2026-09-01T12:00:00Z", "2026-09-08T12:00:00Z")).toBe(7);
    expect(stripeWebhook).toContain("trialEnd = subscription.trial_end");
  });

  it("keeps Mercado Pago four-day policy separate and central in persisted config", () => {
    expect(migration).toContain("default_new_billing_provider text not null default 'stripe'");
    expect(migration).toContain("stripe_trial_duration_days integer not null default 7");
    expect(migration).toContain("mercado_pago_trial_duration_days integer not null default 4");
    expect(migration).toContain("mercado_pago_trial_policy_version text not null default '4d_2026_09'");
    expect(mpAdapter).toContain("frequency: this.trialDurationDays");
    expect(mpAdapter).toContain('frequency_type: "days"');
    expect(mpAdapter).not.toMatch(/frequency:\s*4,\s*\n\s*frequency_type:\s*"days"/);
  });

  it("cannot cut over to Mercado Pago while readiness is false", () => {
    expect(migration).toContain("billing_provider_cutover_guard");
    expect(migration).toContain("default_new_billing_provider = 'stripe' or mercado_pago_cutover_ready = true");
    expect(billingRouter).toContain('requestedProvider === "mercado_pago" && !typedConfig.mercado_pago_cutover_ready');
    expect(billingRouter).toContain('"mercado_pago_cutover_not_ready"');
  });

  it("locks one provider per user and protects existing Stripe relationships", () => {
    expect(migration).toContain("billing_provider = 'stripe'");
    expect(migration).toContain("where (stripe_customer_id is not null or stripe_subscription_id is not null)");
    expect(migration).toContain("for update");
    expect(migration).toContain("billing_provider_locked");
    expect(migration).toContain("billing_provider_conflict");
    expect(migration).toContain("user_subscriptions_provider_exclusivity_check");
    expect(mpWebhook).toContain("stripe_relationship_exists");
    expect(mpWebhook).toContain("duplicate_mercado_pago_subscription");
    expect(mpWebhook).toContain('{ status: "canceled" }');
  });

  it("reuses canonical events instead of creating Mercado Pago event names", () => {
    for (const eventName of [
      "card_added",
      "trial_started",
      "trial_converted_to_paid",
      "trial_cancelled",
      "subscription_cancelled",
      "payment_failed",
      "purchase_completed",
    ]) {
      expect(mpWebhook).toContain(`"${eventName}"`);
    }
    expect(mpWebhook).not.toMatch(/mercado_pago_(trial_started|paid|payment_failed|subscription_cancelled)/);
    expect(mpWebhook).toContain('billing_provider: "mercado_pago"');
  });

  it("validates Mercado Pago webhook signatures and provider state before processing", () => {
    expect(mpWebhook).toContain('req.headers.get("x-signature")');
    expect(mpWebhook).toContain('req.headers.get("x-request-id")');
    expect(mpWebhook).toContain("HMAC");
    expect(mpWebhook).toContain("SHA-256");
    expect(mpWebhook).toContain("timingSafeHexEqual");
    expect(mpWebhook).toContain("payment_events");
    expect(mpWebhook).toContain('provider_event_id: eventId');
  });

  it("fails closed when Mercado Pago trial dates do not match the four-day provider plan", () => {
    expect(mpWebhook).toContain("mercado_pago_trial_policy_mismatch");
    expect(mpWebhook).toContain("mercado_pago_trial_end_mismatch");
    expect(mpWebhook).toContain("subscription.next_payment_date");
    expect(mpWebhook).toContain("providerTrial.frequency_type === \"days\"");
  });

  it("preserves raw Mercado Pago payment failure detail and only maps known reasons", () => {
    expect(mpWebhook).toContain("provider_status_detail");
    expect(mpWebhook).toContain("provider_failure_code");
    expect(mpWebhook).toContain('"cc_rejected_insufficient_amount"');
    expect(mpWebhook).toContain('"insufficient_funds"');
    expect(mpWebhook).toContain('"rejected_by_bank"');
    expect(mpWebhook).toContain('"card_declined"');
    expect(mpWebhook).toContain('"generic_decline"');
    expect(mpWebhook).toContain('return "other"');
    expect(mpWebhook).not.toContain('"expired_card"');
  });

  it("keeps first-value definition intact", () => {
    expect(trackEvent).toContain('eventName === "first_lead_opened"');
    expect(trackEvent).toContain(".eq(\"user_id\", userId)");
    expect(trackEvent).toContain("lead.search_run_id");
    expect(trackEvent).toContain('search.status !== "success"');
    expect(trackEvent).toContain("Number(search.returned_quantity || 0) <= 0");
    expect(trackEvent).toContain('"first_value_reached"');
  });

  it("uses runtime offer policy for new-user UI and defaults safely to Stripe seven days", () => {
    expect(offerHook).toContain('defaultNewBillingProvider: "stripe"');
    expect(offerHook).toContain("trialDurationDays: 7");
    expect(source("src/components/landing/HeroSection.tsx")).toContain("useBillingOfferConfig");
    expect(source("src/pages/Checkout.tsx")).toContain("trialDurationDays");
    expect(source("src/components/landing/CheckoutDialog.tsx")).toContain("trialDurationDays");
  });

  it("routes subscription management by the locked provider", () => {
    const manager = source("supabase/functions/manage-billing-subscription/index.ts");
    expect(manager).toContain("create-customer-portal-session");
    expect(manager).toContain('subscription.billing_provider !== "mercado_pago"');
    expect(manager).toContain('{ status: "canceled" }');
  });
});
