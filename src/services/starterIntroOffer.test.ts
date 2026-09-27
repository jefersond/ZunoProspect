import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("all-plan first-month intro offer", () => {
  const migration = source("supabase/migrations/20260927231000_all_plans_intro_offer.sql");
  const offerConfig = source("supabase/functions/billing-offer-config/index.ts");
  const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");
  const webhook = source("supabase/functions/stripe-webhook/index.ts");
  const pricing = source("src/components/landing/PrecosSection.tsx");
  const checkout = source("src/pages/Checkout.tsx");
  const owner = source("src/components/admin/UsersDashboard.tsx");
  const firstValueTracking = source("supabase/functions/track-event/index.ts");

  it("centralizes the three commercial intro offers", () => {
    expect(migration).toContain("'starter'");
    expect(migration).toContain("'intro_amount_cents', 2990");
    expect(migration).toContain("'regular_amount_cents', 4700");
    expect(migration).toContain("'pro'");
    expect(migration).toContain("'intro_amount_cents', 5990");
    expect(migration).toContain("'regular_amount_cents', 9700");
    expect(migration).toContain("'agency'");
    expect(migration).toContain("'intro_amount_cents', 15990");
    expect(migration).toContain("'regular_amount_cents', 24700");
    expect(migration).toContain("intro_offer_key = 'first_month_discount'");
    expect(migration).toContain("intro_offer_duration = 'first_billing_period'");
    expect(offerConfig).toContain("intro_offer_plans");
  });

  it("preserves trial independently from direct purchase", () => {
    expect(stripeCheckout).toContain("billingConfig.stripe_trial_duration_days");
    expect(stripeCheckout).toContain('conversionPath === "trial" ? Math.round(configuredTrialDays) : 0');
    expect(stripeCheckout).toContain('conversionPath === "trial" ? { trial_period_days: trialDurationDays } : {}');
    expect(stripeCheckout).toContain('conversionPath === "direct_purchase"');
  });

  it("uses the regular recurring price and a once-only Stripe coupon", () => {
    expect(stripeCheckout).toContain("unit_amount: unitAmount");
    expect(stripeCheckout).toContain('discounts: [{ coupon: stripeIntroCouponId }]');
    expect(stripeCheckout).toContain('coupon.duration !== "once"');
    expect(stripeCheckout).toContain("expectedDiscount = regularAmountCents - introAmountCents");
    expect(stripeCheckout).not.toContain("percent_off");
  });

  it("enforces one intro offer lifetime per canonical user", () => {
    expect(migration).toContain("billing_intro_offer_one_lifetime_per_user");
    expect(migration).toContain("on public.billing_intro_offer_redemptions(user_id)");
    expect(stripeCheckout).toContain('.eq("user_id", user.id)');
    expect(stripeCheckout).toContain('existingClaim?.status === "redeemed"');
    expect(stripeCheckout).toContain("hasPaidHistory");
  });

  it("prevents cross-plan checkout races and safely switches plan", () => {
    expect(stripeCheckout).toContain('"intro_offer_checkout_in_progress"');
    expect(stripeCheckout).toContain("stripe.checkout.sessions.expire");
    expect(stripeCheckout).toContain('"intro_offer_payment_pending"');
    expect(stripeCheckout).toContain("zuno_intro_checkout:");
    expect(stripeCheckout).toContain("claim_generation");
  });

  it("does not combine a Pro intro discount with promotion-code entry", () => {
    expect(stripeCheckout).toContain('allow_promotion_codes: planId === "pro" && !introOfferApplied');
  });

  it("redeems only after confirmed provider payment and stays webhook idempotent", () => {
    expect(webhook).toContain('event.type === "invoice.payment_succeeded"');
    expect(webhook).toContain('event.type === "invoice.paid"');
    expect(webhook).toContain('.from("billing_intro_offer_redemptions")');
    expect(webhook).toContain('status: "redeemed"');
    expect(webhook).toContain("redeemed_at");
    expect(webhook).toContain('upsert(values, { onConflict: "provider,provider_event_id" })');
  });

  it("tracks plan, direct path and intro offer values", () => {
    expect(webhook).toContain("intro_offer_price");
    expect(webhook).toContain("regular_price");
    expect(pricing).toContain("intro_offer_price");
    expect(pricing).toContain("plan: plan.id");
    expect(checkout).toContain("conversion_path");
  });

  it("keeps payment separate from first value", () => {
    expect(firstValueTracking).toContain('"first_value_reached"');
    expect(webhook).not.toContain("first_value_reached");
  });

  it("shows trial and direct choices clearly on mobile-safe cards", () => {
    expect(pricing).toContain("Começar meu teste");
    expect(pricing).toContain("Economize no primeiro mês");
    expect(pricing).toContain('"Assinar agora"');
    expect(pricing).toContain("w-full");
    expect(checkout).toContain("Economize no primeiro mês");
  });

  it("keeps owner paid-state labels and plan badge together", () => {
    expect(owner).toContain("PAID DIRECT COM INTRO OFFER");
    expect(owner).toContain("PAID DIRECT");
    expect(owner).toContain("PAID VIA TRIAL");
    expect(owner).toContain("getPlanBadge");
  });

  it("does not implement early conversion from an active trial", () => {
    expect(stripeCheckout).toContain('"subscription_already_active"');
    expect(offerConfig).toContain('"active_trial_not_supported"');
  });
});
