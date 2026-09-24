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
    private readonly userEmail: string,
    private readonly trialDurationDays: number,
    private readonly trialPolicyVersion: string,
    private readonly backUrl: string,
  ) {}

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const amount = billingAmount(input.planId, input.billingCycle);

    let { data: billingPlan, error: billingPlanError } = await this.supabaseAdmin
      .from("mercado_pago_billing_plans")
      .select("*")
      .eq("plan_id", input.planId)
      .eq("billing_cycle", input.billingCycle)
      .eq("trial_policy_version", this.trialPolicyVersion)
      .eq("transaction_amount", amount)
      .eq("currency_id", "BRL")
      .maybeSingle();

    if (billingPlanError) throw new Error("mercado_pago_plan_lookup_failed");

    if (!billingPlan) {
      const { data: inserted, error: insertError } = await this.supabaseAdmin
        .from("mercado_pago_billing_plans")
        .insert({
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
          .from("mercado_pago_billing_plans")
          .select("*")
          .eq("plan_id", input.planId)
          .eq("billing_cycle", input.billingCycle)
          .eq("trial_policy_version", this.trialPolicyVersion)
          .eq("transaction_amount", amount)
          .eq("currency_id", "BRL")
          .maybeSingle();

        billingPlan = raced.data;
      } else {
        billingPlan = inserted;
      }
    }

    if (!billingPlan) throw new Error("mercado_pago_plan_lock_failed");

    if (!billingPlan.provider_plan_id) {
      if (billingPlan.status !== "creating") {
        throw new Error("mercado_pago_plan_recovery_required");
      }

      try {
        const plan = await mpRequest(
          this.accessToken,
          "/preapproval_plan",
          {
            method: "POST",
            body: JSON.stringify({
              reason: `ZUNO PROSPECT - ${BILLING_CATALOG[input.planId].displayName}`,
              external_reference: `zuno:${input.planId}:${input.billingCycle}:${this.trialPolicyVersion}`,
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

        if (!plan?.id) throw new Error("mercado_pago_plan_missing_id");

        const { data: savedPlan, error: savePlanError } = await this.supabaseAdmin
          .from("mercado_pago_billing_plans")
          .update({
            provider_plan_id: String(plan.id),
            status: "ready",
            last_error_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", billingPlan.id)
          .select("*")
          .single();

        if (savePlanError || !savedPlan) throw new Error("mercado_pago_plan_persist_failed");
        billingPlan = savedPlan;
      } catch (error) {
        await this.supabaseAdmin
          .from("mercado_pago_billing_plans")
          .update({
            status: "failed",
            last_error_code: safeErrorCode((error as Error & { code?: string })?.code || (error as Error)?.message),
            updated_at: new Date().toISOString(),
          })
          .eq("id", billingPlan.id);
        throw error;
      }
    }

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

    if (checkout?.provider_subscription_id && checkout?.checkout_url) {
      return {
        provider: this.provider,
        url: checkout.checkout_url,
        checkoutId: checkout.provider_subscription_id,
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
      };
    }

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
          provider_plan_id: billingPlan.provider_plan_id,
          status: "creating",
        })
        .select("*")
        .single();

      if (insertError || !inserted) throw new Error("mercado_pago_checkout_lock_failed");
      checkout = inserted;
    } else if (!checkout.provider_subscription_id) {
      throw new Error("mercado_pago_checkout_recovery_required");
    }

    try {
      const subscription = await mpRequest(
        this.accessToken,
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify({
            preapproval_plan_id: billingPlan.provider_plan_id,
            reason: `ZUNO PROSPECT - ${BILLING_CATALOG[input.planId].displayName}`,
            external_reference: this.userId,
            payer_email: this.userEmail,
            back_url: this.backUrl,
            status: "pending",
          }),
        },
      );

      if (!subscription?.id || !subscription?.init_point) {
        throw new Error("mercado_pago_subscription_missing_checkout_url");
      }

      const { error: persistError } = await this.supabaseAdmin
        .from("mercado_pago_checkout_sessions")
        .update({
          provider_subscription_id: String(subscription.id),
          checkout_url: String(subscription.init_point),
          status: "ready",
          last_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkout.id);

      if (persistError) throw new Error("mercado_pago_checkout_persist_failed");

      await this.supabaseAdmin
        .from("user_subscriptions")
        .update({
          mercado_pago_plan_id: String(billingPlan.provider_plan_id),
          trial_duration_days: this.trialDurationDays,
          trial_policy_version: this.trialPolicyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("billing_provider", "mercado_pago");

      return {
        provider: this.provider,
        url: String(subscription.init_point),
        checkoutId: String(subscription.id),
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
