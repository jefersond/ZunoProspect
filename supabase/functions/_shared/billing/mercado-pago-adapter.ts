import { billingAmount, billingFrequencyMonths, BILLING_CATALOG } from "./catalog.ts";
import type {
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingIntroOfferPlanConfig,
  BillingProviderAdapter,
} from "./types.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

type IntroOfferConfig = {
  enabled: boolean;
  key: string;
  duration: "first_billing_period";
  plans: Partial<Record<"starter" | "pro" | "agency", BillingIntroOfferPlanConfig>>;
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
    private readonly introOffer: IntroOfferConfig,
  ) {}

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const conversionPath = input.conversionPath ?? "trial";
    const regularAmount = billingAmount(input.planId, input.billingCycle);
    const regularAmountCents = Math.round(regularAmount * 100);
    const directPurchase = conversionPath === "direct_purchase";
    const trialDurationDays = directPurchase ? 0 : this.trialDurationDays;
    const trialPolicyVersion = directPurchase ? "none" : this.trialPolicyVersion;

    const planOffer = this.introOffer.plans[input.planId];
    const introConfigured = Boolean(
      directPurchase
      && input.billingCycle === "monthly"
      && this.introOffer.enabled
      && this.introOffer.duration === "first_billing_period"
      && this.introOffer.key
      && planOffer
      && Number(planOffer.intro_amount_cents) > 0
      && Number(planOffer.regular_amount_cents) === regularAmountCents
      && Number(planOffer.intro_amount_cents) < regularAmountCents
      && (!input.offerId || input.offerId === this.introOffer.key)
    );

    const { data: localRelation, error: relationError } = await this.supabaseAdmin
      .from("user_subscriptions")
      .select("last_payment_succeeded_at,subscription_status,status,mercado_pago_subscription_id")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (relationError) throw new Error("mercado_pago_subscription_lookup_failed");

    const localStatus = String(localRelation?.subscription_status || localRelation?.status || "").toLowerCase();
    if (["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(localStatus)) {
      const error = new Error("subscription_already_active");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    let introClaim: any = null;
    let introOfferApplied = false;
    let introAmountCents = 0;

    if (introConfigured && !localRelation?.last_payment_succeeded_at) {
      const { data: existingClaim, error: claimError } = await this.supabaseAdmin
        .from("billing_intro_offer_redemptions")
        .select("*")
        .eq("user_id", this.userId)
        .maybeSingle();
      if (claimError) throw new Error("intro_offer_lookup_failed");

      if (!existingClaim?.redeemed_at && existingClaim?.status !== "redeemed") {
        if (existingClaim && existingClaim.billing_provider !== "mercado_pago") {
          throw new Error("intro_offer_provider_locked");
        }
        if (
          existingClaim
          && existingClaim.provider_checkout_id
          && String(existingClaim.plan_id) !== input.planId
        ) {
          const error = new Error("intro_offer_checkout_in_progress");
          (error as Error & { status?: number }).status = 409;
          throw error;
        }

        introClaim = existingClaim;
        introAmountCents = Number(planOffer?.intro_amount_cents || 0);

        if (!introClaim) {
          const { data: inserted, error: insertError } = await this.supabaseAdmin
            .from("billing_intro_offer_redemptions")
            .insert({
              user_id: this.userId,
              offer_key: this.introOffer.key,
              plan_id: input.planId,
              billing_cycle: input.billingCycle,
              conversion_path: conversionPath,
              billing_provider: "mercado_pago",
              intro_amount_cents: introAmountCents,
              regular_amount_cents: regularAmountCents,
              provider_coupon_id: null,
              provider_customer_id: null,
              status: "claimed",
            })
            .select("*")
            .single();

          if (insertError?.code === "23505") {
            const { data: raced, error: racedError } = await this.supabaseAdmin
              .from("billing_intro_offer_redemptions")
              .select("*")
              .eq("user_id", this.userId)
              .single();
            if (racedError || !raced || raced.redeemed_at || raced.status === "redeemed") {
              introClaim = null;
            } else if (raced.billing_provider !== "mercado_pago" || String(raced.plan_id) !== input.planId) {
              throw new Error("intro_offer_checkout_in_progress");
            } else {
              introClaim = raced;
            }
          } else if (insertError || !inserted) {
            throw new Error("intro_offer_claim_failed");
          } else {
            introClaim = inserted;
          }
        }

        if (introClaim) {
          introOfferApplied = true;
          introAmountCents = Number(planOffer?.intro_amount_cents || introClaim.intro_amount_cents || 0);
        }
      }
    }

    const initialAmount = introOfferApplied ? introAmountCents / 100 : regularAmount;
    const introOfferKey = introOfferApplied ? this.introOffer.key : null;

    let { data: checkout, error: checkoutError } = await this.supabaseAdmin
      .from("mercado_pago_checkout_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_id", input.planId)
      .eq("billing_cycle", input.billingCycle)
      .eq("conversion_path", conversionPath)
      .eq("trial_policy_version", trialPolicyVersion)
      .eq("transaction_amount", initialAmount)
      .eq("currency_id", "BRL")
      .maybeSingle();

    if (checkoutError) throw new Error("mercado_pago_checkout_lookup_failed");

    if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
      if (introOfferApplied && introClaim?.id && !introClaim.provider_checkout_id) {
        await this.supabaseAdmin
          .from("billing_intro_offer_redemptions")
          .update({
            provider_checkout_id: String(checkout.provider_plan_id),
            last_checkout_created_at: checkout.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", introClaim.id)
          .eq("status", "claimed");
      }
      return {
        provider: this.provider,
        url: checkout.checkout_url,
        checkoutId: checkout.provider_plan_id,
        trialDurationDays,
        trialPolicyVersion,
        conversionPath,
        introOfferApplied,
        introOfferKey,
        introPrice: introOfferApplied ? initialAmount : null,
        regularPrice: regularAmount,
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
          conversion_path: conversionPath,
          trial_duration_days: trialDurationDays,
          trial_policy_version: trialPolicyVersion,
          transaction_amount: initialAmount,
          currency_id: "BRL",
          intro_offer_applied: introOfferApplied,
          intro_offer_key: introOfferKey,
          intro_amount_cents: introOfferApplied ? introAmountCents : null,
          regular_amount_cents: regularAmountCents,
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
          .eq("conversion_path", conversionPath)
          .eq("trial_policy_version", trialPolicyVersion)
          .eq("transaction_amount", initialAmount)
          .eq("currency_id", "BRL")
          .maybeSingle();

        checkout = raced.data;
        if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
          return {
            provider: this.provider,
            url: checkout.checkout_url,
            checkoutId: checkout.provider_plan_id,
            trialDurationDays,
            trialPolicyVersion,
            conversionPath,
            introOfferApplied,
            introOfferKey,
            introPrice: introOfferApplied ? initialAmount : null,
            regularPrice: regularAmount,
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
        transaction_amount: initialAmount,
        currency_id: "BRL",
      };
      if (!directPurchase) {
        autoRecurring.free_trial = {
          frequency: this.trialDurationDays,
          frequency_type: "days",
        };
      }

      const providerPlan = await mpRequest(
        this.accessToken,
        "/preapproval_plan",
        {
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
        },
      );

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

      if (introOfferApplied && introClaim?.id) {
        const { error: claimBindError } = await this.supabaseAdmin
          .from("billing_intro_offer_redemptions")
          .update({
            offer_key: this.introOffer.key,
            plan_id: input.planId,
            billing_cycle: input.billingCycle,
            conversion_path: conversionPath,
            billing_provider: "mercado_pago",
            intro_amount_cents: introAmountCents,
            regular_amount_cents: regularAmountCents,
            provider_checkout_id: String(providerPlan.id),
            last_checkout_created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", introClaim.id)
          .eq("status", "claimed");
        if (claimBindError) throw new Error("intro_offer_checkout_bind_failed");
      }

      await this.supabaseAdmin
        .from("user_subscriptions")
        .update({
          mercado_pago_plan_id: String(providerPlan.id),
          trial_duration_days: trialDurationDays,
          trial_policy_version: trialPolicyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("billing_provider", "mercado_pago");

      return {
        provider: this.provider,
        url: String(providerPlan.init_point),
        checkoutId: String(providerPlan.id),
        trialDurationDays,
        trialPolicyVersion,
        conversionPath,
        introOfferApplied,
        introOfferKey,
        introPrice: introOfferApplied ? initialAmount : null,
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
