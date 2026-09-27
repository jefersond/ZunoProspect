import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Starter first-month intro offer", () => {
  const migration = source("supabase/migrations/20260927225000_starter_intro_offer.sql");
  const offerConfig = source("supabase/functions/billing-offer-config/index.ts");
  const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");
  const webhook = source("supabase/functions/stripe-webhook/index.ts");
  const pricing = source("src/components/landing/PrecosSection.tsx");
  const checkout = source("src/pages/Checkout.tsx");
  const owner = source("src/components/admin/UsersDashboard.tsx");
  const firstValueTracking = source("supabase/functions/track-event/index.ts");

  it("keeps one canonical commercial offer configuration", () => {
    expect(migration).toContain("starter_intro_offer_intro_amount_cents integer not null default 2990");
    expect(migration).toContain("starter_intro_offer_regular_amount_cents integer not null default 4700");
    expect(migration).toContain("starter_intro_offer_enabled boolean not null default true");
    expect(migration).toContain("starter_intro_offer_duration text not null default 'first_billing_period'");
    expect(migration).toContain("stripe_starter_intro_coupon_id = 'starter_first_month_29_90_v1'");
    expect(offerConfig).toContain("starter_intro_offer_intro_amount_cents");
    expect(offerConfig).toContain("starter_intro_offer_regular_amount_cents");
  });

  it("preserves the current trial independently from the intro offer", () => {
    expect(stripeCheckout).toContain("billingConfig.stripe_trial_duration_days");
    expect(stripeCheckout).toContain('conversionPath === "trial" ? Math.round(configuredTrialDays) : 0');
    expect(stripeCheckout).toContain('conversionPath === "trial" ? { trial_period_days: trialDurationDays } : {}');
    expect(stripeCheckout).toContain('conversionPath === "direct_purchase"');
  });

  it("applies a fixed Stripe coupon only to eligible Starter monthly direct purchase", () => {
    expect(stripeCheckout).toContain('planId === String(billingConfig.starter_intro_offer_plan_id || "starter")');
    expect(stripeCheckout).toContain('billingCycle === String(billingConfig.starter_intro_offer_billing_cycle || "monthly")');
    expect(stripeCheckout).toContain('conversionPath === String(billingConfig.starter_intro_offer_conversion_path || "direct_purchase")');
    expect(stripeCheckout).toContain('discounts: [{ coupon: stripeIntroCouponId }]');
    expect(stripeCheckout).toContain('coupon.duration !== "once"');
    expect(stripeCheckout).toContain("expectedDiscount = regularAmountCents - introAmountCents");
    expect(stripeCheckout).toContain("regularAmountCents !== unitAmount");
    expect(stripeCheckout).not.toContain("percent_off");
  });

  it("charges the intro amount once and keeps regular recurring price as the subscription price", () => {
    expect(stripeCheckout).toContain("unit_amount: unitAmount");
    expect(stripeCheckout).toContain("introAmountCents");
    expect(stripeCheckout).toContain("regularAmountCents");
    expect(stripeCheckout).toContain("amount: introOfferApplied ? introAmountCents : unitAmount");
    expect(stripeCheckout).not.toContain("unit_amount: introAmountCents");
  });

  it("persists one claim per canonical user and never restores redemption after cancel", () => {
    expect(migration).toContain("unique(user_id, offer_key)");
    expect(migration).toContain("status text not null default 'claimed'");
    expect(migration).toContain("redeemed_at timestamptz");
    expect(stripeCheckout).toContain('.eq("user_id", user.id)');
    expect(stripeCheckout).toContain('.eq("offer_key", introOfferKey)');
    expect(stripeCheckout).toContain('existingClaim?.status !== "redeemed"');
    expect(stripeCheckout).toContain("hasPaidHistory");
  });

  it("resumes abandoned checkout and uses claim generation for safe retry", () => {
    expect(stripeCheckout).toContain("previousSession.status === \"open\"");
    expect(stripeCheckout).toContain("provider_checkout_id");
    expect(stripeCheckout).toContain("claim_generation");
    expect(stripeCheckout).toContain("introClaim.id");
    expect(stripeCheckout).toContain("idempotencyKey");
  });

  it("marks the offer redeemed only from confirmed invoice payment flow", () => {
    expect(webhook).toContain('event.type === "invoice.payment_succeeded"');
    expect(webhook).toContain('event.type === "invoice.paid"');
    expect(webhook).toContain('.from("billing_intro_offer_redemptions")');
    expect(webhook).toContain('status: "redeemed"');
    expect(webhook).toContain("redeemed_at");
    expect(webhook).toContain('.eq("status", "claimed")');
    expect(webhook).toContain('conversionPath !== "direct_purchase"');
  });

  it("adds intro offer analytics without confusing payment with first value", () => {
    expect(webhook).toContain("intro_offer_applied");
    expect(webhook).toContain("intro_price");
    expect(webhook).toContain("regular_price");
    expect(pricing).toContain("intro_offer");
    expect(checkout).toContain("intro_offer");
    expect(firstValueTracking).toContain('"first_value_reached"');
    expect(webhook).not.toContain("first_value_reached");
  });

  it("shows trial and direct offer as two clear mobile-safe stacked choices", () => {
    expect(pricing).toContain("Começar meu teste");
    expect(pricing).toContain("Assine agora e economize no primeiro mês");
    expect(pricing).toContain("Assinar agora por R$");
    expect(pricing).toContain("Cancele quando quiser.");
    expect(pricing).toContain("w-full");
    expect(checkout).toContain("Economize no primeiro mês");
    expect(checkout).toContain("na data confirmada pelo Stripe");
  });

  it("labels paid direct intro conversions in the Owner detail", () => {
    expect(owner).toContain("PAID DIRECT COM INTRO OFFER");
    expect(owner).toContain('event?.event_data?.intro_offer_applied === true');
    expect(owner).toContain("PAID DIRECT");
    expect(owner).toContain("PAID VIA TRIAL");
  });

  it("does not implement early trial conversion in this offer path", () => {
    expect(stripeCheckout).toContain('"subscription_already_active"');
    expect(offerConfig).toContain('"active_trial_not_supported"');
  });
});
