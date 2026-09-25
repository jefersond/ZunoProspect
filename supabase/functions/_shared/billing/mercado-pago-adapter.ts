import { billingAmount, billingFrequencyMonths, BILLING_CATALOG } from "./catalog.ts";
import type { BillingCheckoutInput, BillingCheckoutResult, BillingProviderAdapter } from "./types.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

const MP_API = "https://api.mercadopago.com";

function safeErrorCode(value: unknown) {
  return String(value || "mercado_pago_request_failed").slice(0, 120);
}

async function mpRequest(
  token: string,
  path: string,
  init: RequestInit,
) {
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
  ) {}

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const amount = billingAmount(input.planId, input.billingCycle);

    let { data: checkout, error: checkoutError } = await this.supabaseAdmin
      .from("mercado_pago_checkout_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_id", input.planId)
      .eq("billing_cycle", input.billingCycle)
      .eq("trial_policy_version", this.trialPolicyVersion)
      .eq("transaction_amount", amount)
      .eq("currency_id", "BRL")
      .maybeSingle();

    if (checkoutError) throw new Error("mercado_pago_checkout_lookup_failed");

    if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
      return {
        provider: this.provider,
        url: checkout.checkout_url,
        checkoutId: checkout.provider_plan_id,
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
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
          trial_duration_days: this.trialDurationDays,
          trial_policy_version: this.trialPolicyVersion,
          transaction_amount: amount,
          currency_id: "BRL",
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
          .eq("transaction_amount", amount)
          .eq("currency_id", "BRL")
          .maybeSingle();

        checkout = raced.data;
        if (checkout?.provider_plan_id && checkout?.checkout_url && checkout?.status === "ready") {
          return {
            provider: this.provider,
            url: checkout.checkout_url,
            checkoutId: checkout.provider_plan_id,
            trialDurationDays: this.trialDurationDays,
            trialPolicyVersion: this.trialPolicyVersion,
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
      const providerPlan = await mpRequest(
        this.accessToken,
        "/preapproval_plan",
        {
          method: "POST",
          body: JSON.stringify({
            reason: `ZUNO PROSPECT - ${BILLING_CATALOG[input.planId].displayName}`,
            external_reference: this.userId,
            auto_recurring: {
              frequency: billingFrequencyMonths(input.billingCycle),
              frequency_type: "months",
              free_trial: {
                frequency: this.trialDurationDays,
                frequency_type: "days",
              },
              transaction_amount: amount,
              currency_id: "BRL",
            },
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

      await this.supabaseAdmin
        .from("user_subscriptions")
        .update({
          mercado_pago_plan_id: String(providerPlan.id),
          trial_duration_days: this.trialDurationDays,
          trial_policy_version: this.trialPolicyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("billing_provider", "mercado_pago");

      return {
        provider: this.provider,
        url: String(providerPlan.init_point),
        checkoutId: String(providerPlan.id),
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
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
