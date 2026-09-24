import { billingAmount, billingFrequencyMonths, BILLING_CATALOG, type BillingCycle, type BillingPlanId } from "./catalog.ts";
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
  idempotencyKey?: string,
) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || payload?.error || "mercado_pago_request_failed");
    (err as Error & { code?: string; status?: number }).code = safeErrorCode(payload?.cause?.[0]?.code || payload?.error || payload?.status);
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
    const amount = billingAmount(input.planId as BillingPlanId, input.billingCycle as BillingCycle);

    const { data: existing, error: existingError } = await this.supabaseAdmin
      .from("mercado_pago_checkout_plans")
      .select("id,provider_plan_id,checkout_url,status,last_error_code")
      .eq("user_id", this.userId)
      .eq("plan_id", input.planId)
      .eq("billing_cycle", input.billingCycle)
      .eq("trial_policy_version", this.trialPolicyVersion)
      .eq("transaction_amount", amount)
      .eq("currency_id", "BRL")
      .maybeSingle();

    if (existingError) throw new Error("mercado_pago_checkout_lookup_failed");
    if (existing?.status === "ready" && existing?.checkout_url && existing?.provider_plan_id) {
      return {
        provider: this.provider,
        url: existing.checkout_url,
        checkoutId: existing.provider_plan_id,
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
      };
    }

    let rowId = existing?.id as string | undefined;
    if (!rowId) {
      const { data: created, error: createError } = await this.supabaseAdmin
        .from("mercado_pago_checkout_plans")
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
        .select("id")
        .single();

      if (createError || !created?.id) {
        const { data: raced } = await this.supabaseAdmin
          .from("mercado_pago_checkout_plans")
          .select("id,provider_plan_id,checkout_url,status")
          .eq("user_id", this.userId)
          .eq("plan_id", input.planId)
          .eq("billing_cycle", input.billingCycle)
          .eq("trial_policy_version", this.trialPolicyVersion)
          .eq("transaction_amount", amount)
          .eq("currency_id", "BRL")
          .maybeSingle();

        if (raced?.status === "ready" && raced?.checkout_url && raced?.provider_plan_id) {
          return {
            provider: this.provider,
            url: raced.checkout_url,
            checkoutId: raced.provider_plan_id,
            trialDurationDays: this.trialDurationDays,
            trialPolicyVersion: this.trialPolicyVersion,
          };
        }
        if (!raced?.id) throw new Error("mercado_pago_checkout_idempotency_failed");
        rowId = raced.id;
      } else {
        rowId = created.id;
      }
    }

    try {
      const plan = await mpRequest(
        this.accessToken,
        "/preapproval_plan",
        {
          method: "POST",
          body: JSON.stringify({
            reason: `ZUNO PROSPECT - ${BILLING_CATALOG[input.planId as BillingPlanId].displayName}`,
            external_reference: `zuno_${this.userId}`,
            auto_recurring: {
              frequency: billingFrequencyMonths(input.billingCycle as BillingCycle),
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
        `zuno-mp-plan-${rowId}`,
      );

      if (!plan?.id || !plan?.init_point) throw new Error("mercado_pago_plan_missing_checkout_url");

      const { error: updateError } = await this.supabaseAdmin
        .from("mercado_pago_checkout_plans")
        .update({
          provider_plan_id: String(plan.id),
          checkout_url: String(plan.init_point),
          status: "ready",
          last_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);

      if (updateError) throw new Error("mercado_pago_checkout_persist_failed");

      await this.supabaseAdmin
        .from("user_subscriptions")
        .update({
          mercado_pago_plan_id: String(plan.id),
          trial_duration_days: this.trialDurationDays,
          trial_policy_version: this.trialPolicyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("billing_provider", "mercado_pago");

      return {
        provider: this.provider,
        url: String(plan.init_point),
        checkoutId: String(plan.id),
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
      };
    } catch (error) {
      await this.supabaseAdmin
        .from("mercado_pago_checkout_plans")
        .update({
          status: "failed",
          last_error_code: safeErrorCode((error as Error & { code?: string })?.code || (error as Error)?.message),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      throw error;
    }
  }
}
