import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Stripe optional direct purchase", () => {
  const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");
  const billingCheckout = source("supabase/functions/create-billing-checkout/index.ts");
  const stripeAdapter = source("supabase/functions/_shared/billing/stripe-adapter.ts");
  const catalog = source("supabase/functions/_shared/billing/catalog.ts");
  const webhook = source("supabase/functions/stripe-webhook/index.ts");
  const pricing = source("src/components/landing/PrecosSection.tsx");
  const checkout = source("src/pages/Checkout.tsx");
  const auth = source("src/pages/Auth.tsx");
  const owner = source("src/components/admin/UsersDashboard.tsx");

  it("preserves trial as the default conversion path", () => {
    expect(stripeAdapter).toContain('const conversionPath = input.conversionPath ?? "trial"');
    expect(billingCheckout).toContain('body.conversionPath');
    expect(billingCheckout).toContain(': "trial"');
    expect(stripeCheckout).toContain('conversionPath === "trial" ? Math.round(configuredTrialDays) : 0');
    expect(stripeCheckout).toContain('conversionPath === "trial" ? { trial_period_days: trialDurationDays } : {}');
  });

  it("creates direct purchase without a Stripe trial", () => {
    expect(stripeCheckout).toContain('body.conversionPath === "direct_purchase"');
    expect(stripeCheckout).toContain('trial_type: conversionPath === "trial" ? "card_required_trial" : "none"');
    expect(stripeCheckout).not.toContain("trial_period_days: 7");
    expect(stripeCheckout).not.toContain('trial_days: "7"');
  });

  it("takes Stripe trial policy from canonical billing config", () => {
    expect(stripeCheckout).toContain('.from("billing_provider_config")');
    expect(stripeCheckout).toContain("stripe_trial_duration_days");
    expect(stripeCheckout).toContain("stripe_trial_policy_version");
    expect(stripeCheckout).toContain("billingConfig.stripe_trial_duration_days");
    expect(stripeCheckout).toContain("billingConfig.stripe_trial_policy_version");
  });

  it("uses the shared real billing catalog for amounts", () => {
    expect(stripeCheckout).toContain("BILLING_CATALOG");
    expect(stripeCheckout).toContain("billingAmount(planId, billingCycle) * 100");
    expect(catalog).toContain('starter: { displayName: "Starter", monthlyAmount: 47, annualAmount: 470');
    expect(catalog).toContain('pro: { displayName: "Pro", monthlyAmount: 97, annualAmount: 970');
    expect(catalog).toContain('agency: { displayName: "Agency", monthlyAmount: 247, annualAmount: 2470');
  });

  it("keeps Stripe direct purchase intact while Mercado Pago can implement the same path independently", () => {
    expect(stripeAdapter).toContain('const conversionPath = input.conversionPath ?? "trial"');
    expect(billingCheckout).toContain("new StripeAdapter");
    expect(billingCheckout).toContain("new MercadoPagoAdapter");
    expect(billingCheckout).not.toContain('"direct_purchase_stripe_only"');
  });

  it("guards against duplicate subscriptions and retry duplication", () => {
    expect(stripeCheckout).toContain('"subscription_already_active"');
    expect(stripeCheckout).toContain("stripe.subscriptions.retrieve");
    expect(stripeCheckout).toContain("stripe.subscriptions.list");
    expect(stripeCheckout).toContain("idempotencyKey");
    expect(stripeCheckout).toContain('zuno_checkout:${user.id}:${planId}:${billingCycle}:${conversionPath}:${localSubscriptionState}:${localSubscription?.stripe_subscription_id || "none"}');
  });

  it("keeps webhook signature and provider-event idempotency", () => {
    expect(webhook).toContain("constructEventAsync");
    expect(webhook).toContain('upsert(values, { onConflict: "provider,provider_event_id" })');
    expect(webhook).toContain("checkDuplicatePurchaseEvent");
  });

  it("distinguishes checkout and purchase analytics by conversion path", () => {
    expect(webhook).toContain('"checkout_completed"');
    expect(webhook).toContain("conversion_path: conversionPath");
    expect(webhook).toContain('"purchase_completed"');
    expect(pricing).toContain("conversion_path: conversionPath");
    expect(checkout).toContain("conversion_path: data.conversionPath");
  });

  it("only emits trial conversion when an actual trial existed", () => {
    expect(webhook).toContain("const paidAfterTrial = Boolean(");
    expect(webhook).toContain("subscription.trial_end");
    expect(webhook).toContain('"trial_converted_to_paid"');
  });

  it("offers an explicit optional immediate-charge path in pricing and checkout", () => {
    expect(pricing).toContain("Prefiro assinar agora");
    expect(pricing).toContain('handleSelectPlano(plan, "direct_purchase")');
    expect(pricing).toContain('Cobrança de R$ {price.toLocaleString("pt-BR")} hoje.');
    expect(checkout).toContain('"Assinatura imediata"');
    expect(checkout).toContain("Não há período de teste neste caminho.");
    expect(checkout).toContain("conversionPath");
    expect(checkout).toContain('navigate("/prospeccao", { replace: true })');
  });

  it("preserves direct purchase through authentication", () => {
    expect(auth).toContain('conversion_path');
    expect(auth).toContain('pending.conversionPath === "direct_purchase"');
    expect(auth).toContain("conversionPath: conversionPathParam");
  });

  it("hides new checkout options for an existing paid subscription in pricing", () => {
    expect(pricing).toContain("hasExistingSubscription");
    expect(pricing).toContain("Seu plano atual já está ativo.");
    expect(pricing).toContain('"active", "trialing", "past_due", "unpaid", "incomplete", "paused"');
  });

  it("distinguishes paid via trial and paid direct in owner detail", () => {
    expect(owner).toContain("PAID DIRECT");
    expect(owner).toContain("PAID VIA TRIAL");
    expect(owner).toContain('event?.event_data?.conversion_path === "direct_purchase"');
    expect(owner).toContain('event?.event_type === "trial_converted_to_paid"');
  });

  it("does not couple payment completion to first value", () => {
    expect(webhook).not.toContain("first_value_reached");
    expect(stripeCheckout).not.toContain("first_value_reached");
  });
});
