import { billingAmount, billingFrequencyMonths, BILLING_CATALOG } from "./catalog.ts";
import type {
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingProviderAdapter,
  BillingProviderConfig,
} from "./types.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

const MP_API = "https://api.mercadopago.com";

function safeErrorCode(value: unknown) {
  return String(value || "mercado_pago_request_failed").slice(0, 120);
}

async function mpRequest(token: string, path: string, init: RequestInit) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || payload?.error || "mercado_pago_request_failed");
    (err as Error & { code?: string; status?: number }).code = safeErrorCode(
      payload?.cause?.[0]?.code || payload?.error || payload?.status,
    );
    (err as Error & { code?: string; status?: number }).status = response.status;
    throw err;
  }

  return payload;
}

export class MercadoPagoAdapter implements BillingProviderAdapter {
  readonly provider = "mercado_pago" as const;

  constructor(
    private readonly supabaseAdmin: SupabaseLike,
    private readonly accessToken: string,
    private readonly userId: string,
    private readonly trialDurationDays: number,
    private readonly trialPolicyVersion: string,
    private readonly backUrl: string,
    private readonly config: BillingProviderConfig,
  ) {}

  private async resolveIntroOffer(input: BillingCheckoutInput, regularAmount: number) {
    const conversionPath = input.conversionPath ?? "trial";
    if (
      conversionPath !== "direct_purchase"
      || input.billingCycle !== "monthly"
      || !this.config.intro_offer_enabled
      || input.offerId !== this.config.intro_offer_key
      || this.config.intro_offer_duration !== "first_billing_period"
    ) {
      return { applied: false, claim: null, introAmount: regularAmount, regularAmount };
    }

    const offer = this.config.intro_offer_plans?.[input.planId];
    const regularAmountCents = Number(offer?.regular_amount_cents || 0);
    const introAmountCents = Number(offer?.intro_amount_cents || 0);
    if (
      !offer
      || regularAmountCents !== Math.round(regularAmount * 100)
      || introAmountCents <= 0
      || introAmountCents >= regularAmountCents
    ) {
      throw new Error("intro_offer_config_invalid");
    }

    const { data: existing, error: lookupError } = await this.supabaseAdmin
      .from("billing_intro_offer_redemptions")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (lookupError) throw new Error("intro_offer_lookup_failed");

    if (existing?.redeemed_at || existing?.status === "redeemed") {
      return { applied: false, claim: null, introAmount: regularAmount, regularAmount };
    }

    let claim = existing;
    if (!claim) {
      const { data: inserted, error: insertError } = await this.supabaseAdmin
        .from("billing_intro_offer_redemptions")
        .insert({
          user_id: this.userId,
          offer_key: this.config.intro_offer_key,
          plan_id: input.planId,
          billing_cycle: input.billingCycle,
          conversion_path: conversionPath,
          billing_provider: "mercado_pago",
          intro_amount_cents: introAmountCents,
          regular_amount_cents: regularAmountCents,
          provider_coupon_id: null,
          status: "claimed",
        })
        .select("*")
        .single();

      if (insertError?.code === "23505") {
        const raced = await this.supabaseAdmin
          .from("billing_intro_offer_redemptions")
          .select("*")
          .eq("user_id", this.userId)
          .single();
        claim = raced.data;
      } else if (insertError || !inserted) {
        throw new Error("intro_offer_claim_failed");
      } else {
        claim = inserted;
      }
    }

    if (claim?.redeemed_at || claim?.status === "redeemed") {
      return { applied: false, claim: null, introAmount: regularAmount, regularAmount };
    }

    if (
      claim.billing_provider !== "mercado_pago"
      || claim.plan_id !== input.planId
      || claim.offer_key !== this.config.intro_offer_key
      || Number(claim.intro_amount_cents) !== introAmountCents
      || Number(claim.regular_amount_cents) !== regularAmountCents
    ) {
      const nextGeneration = Number(claim.claim_generation || 1) + 1;
      const { data: updated, error: updateError } = await this.supabaseAdmin
        .from("billing_intro_offer_redemptions")
        .update({
          offer_key: this.config.intro_offer_key,
          plan_id: input.planId,
          billing_cycle: input.billingCycle,
          conversion_path: conversionPath,
          billing_provider: "mercado_pago",
          intro_amount_cents: introAmountCents,
          regular_amount_cents: regularAmountCents,
          provider_coupon_id: null,
          provider_customer_id: null,
          provider_checkout_id: null,
          provider_subscription_id: null,
          provider_invoice_id: null,
          claim_generation: nextGeneration,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim.id)
        .eq("status", "claimed")
        .select("*")
        .single();
      if (updateError || !updated) throw new Error("intro_offer_claim_refresh_failed");
      claim = updated;
    }

    return {
      applied: true,
      claim,
      introAmount: introAmountCents / 100,
      regularAmount,
    };
  }

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const conversionPath = input.conversionPath ?? "trial";
    const regularAmount = billingAmount(input.planId, input.billingCycle);
    const intro = await this.resolveIntroOffer(input, regularAmount);
    const transactionAmount = intro.applied ? intro.introAmount : regularAmount;
    const trialDays = conversionPath === "trial" ? this.trialDurationDays : 0;

    let { data: checkout, error: checkoutError } = await this.supabaseAdmin
      .from("mercado_pago_checkout_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_id", input.planId)
      .eq("billing_cycle", input.billingCycle)
      .eq("trial_policy_version", this.trialPolicyVersion)
      .eq("transaction_amount", transactionAmount)
      .eq("currency_id", "BRL")
      .eq("conversion_path", conversionPath)
      .maybeSingle();

    if (checkoutError) throw new Error("mercado_pago_checkout_lookup_failed");

    if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
      return {
        provider: this.provider,
        url: checkout.checkout_url,
        checkoutId: checkout.provider_plan_id,
        trialDurationDays: trialDays,
        trialPolicyVersion: this.trialPolicyVersion,
        conversionPath,
        introOfferApplied: Boolean(checkout.intro_offer_applied),
        introOfferKey: checkout.intro_offer_key || null,
        introPrice: checkout.intro_offer_applied ? Number(checkout.transaction_amount) : null,
        regularPrice: Number(checkout.regular_amount_cents || Math.round(regularAmount * 100)) / 100,
      };
    }

    let createdNow = false;
    if (!checkout) {
      const { data: inserted, error: insertError } = await this.supabaseAdmin
        .from("mercado_pago_checkout_sessions")
        .insert({
          user_id: this.userId,
          plan_id: input.planId,
          billing_cycle: input.billingCycle,
          trial_duration_days: trialDays,
          trial_policy_version: this.trialPolicyVersion,
          transaction_amount: transactionAmount,
          currency_id: "BRL",
          conversion_path: conversionPath,
          intro_offer_applied: intro.applied,
          intro_offer_key: intro.applied ? this.config.intro_offer_key : null,
          intro_amount_cents: intro.applied ? Math.round(intro.introAmount * 100) : null,
          regular_amount_cents: Math.round(regularAmount * 100),
          status: "creating",
        })
        .select("*")
        .single();

      if (insertError) {
        const raced = await this.supabaseAdmin
          .from("mercado_pago_checkout_sessions")
          .select("*")
          .eq("user_id", this.userId)
          .eq("plan_id", input.planId)
          .eq("billing_cycle", input.billingCycle)
          .eq("trial_policy_version", this.trialPolicyVersion)
          .eq("transaction_amount", transactionAmount)
          .eq("currency_id", "BRL")
          .eq("conversion_path", conversionPath)
          .maybeSingle();

        checkout = raced.data;
        if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
          return {
            provider: this.provider,
            url: checkout.checkout_url,
            checkoutId: checkout.provider_plan_id,
            trialDurationDays: trialDays,
            trialPolicyVersion: this.trialPolicyVersion,
            conversionPath,
            introOfferApplied: Boolean(checkout.intro_offer_applied),
            introOfferKey: checkout.intro_offer_key || null,
            introPrice: checkout.intro_offer_applied ? Number(checkout.transaction_amount) : null,
            regularPrice: Number(checkout.regular_amount_cents || Math.round(regularAmount * 100)) / 100,
          };
        }
        throw new Error("mercado_pago_checkout_in_progress");
      }

      checkout = inserted;
      createdNow = true;
    }

    if (!checkout?.id) throw new Error("mercado_pago_checkout_lock_failed");
    if (!createdNow || checkout.status !== "creating") {
      throw new Error("mercado_pago_checkout_recovery_required");
    }

    try {
      const autoRecurring: Record<string, unknown> = {
        frequency: billingFrequencyMonths(input.billingCycle),
        frequency_type: "months",
        transaction_amount: transactionAmount,
        currency_id: "BRL",
      };
      if (conversionPath === "trial") {
        autoRecurring.free_trial = {
          frequency: trialDays,
          frequency_type: "days",
        };
      }

      const providerPlan = await mpRequest(this.accessToken, "/preapproval_plan", {
        method: "POST",
        body: JSON.stringify({
          reason: `ZUNO PROSPECT - ${BILLING_CATALOG[input.planId].displayName}`,
          external_reference: this.userId,
          auto_recurring: autoRecurring,
          payment_methods_allowed: {
            payment_types: [{ id: "credit_card" }],
          },
          back_url: this.backUrl,
        }),
      });

      if (!providerPlan?.id || !providerPlan?.init_point) {
        throw new Error("mercado_pago_plan_missing_checkout_url");
      }

      const { error: persistError } = await this.supabaseAdmin
        .from("mercado_pago_checkout_sessions")
        .update({
          provider_plan_id: String(providerPlan.id),
          checkout_url: String(providerPlan.init_point),
          status: "ready",
          last_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkout.id);

      if (persistError) throw new Error("mercado_pago_checkout_persist_failed");

      if (intro.applied && intro.claim?.id) {
        const { error: claimPersistError } = await this.supabaseAdmin
          .from("billing_intro_offer_redemptions")
          .update({
            provider_checkout_id: String(providerPlan.id),
            last_checkout_created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", intro.claim.id)
          .eq("status", "claimed");
        if (claimPersistError) throw new Error("intro_offer_checkout_persist_failed");
      }

      await this.supabaseAdmin
        .from("user_subscriptions")
        .update({
          mercado_pago_plan_id: String(providerPlan.id),
          trial_duration_days: trialDays,
          trial_policy_version: this.trialPolicyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("billing_provider", "mercado_pago");

      return {
        provider: this.provider,
        url: String(providerPlan.init_point),
        checkoutId: String(providerPlan.id),
        trialDurationDays: trialDays,
        trialPolicyVersion: this.trialPolicyVersion,
        conversionPath,
        introOfferApplied: intro.applied,
        introOfferKey: intro.applied ? this.config.intro_offer_key : null,
        introPrice: intro.applied ? intro.introAmount : null,
        regularPrice: regularAmount,
      };
    } catch (error) {
      await this.supabaseAdmin
        .from("mercado_pago_checkout_sessions")
        .update({
          status: "failed",
          last_error_code: safeErrorCode((error as Error & { code?: string })?.code || (error as Error)?.message),
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkout.id);
      throw error;
    }
  }
}
