import type { BillingCheckoutInput, BillingCheckoutResult, BillingProviderAdapter } from "./types.ts";

export class StripeAdapter implements BillingProviderAdapter {
  readonly provider = "stripe" as const;

  constructor(
    private readonly supabaseUrl: string,
    private readonly authHeader: string,
    private readonly trialDurationDays: number,
    private readonly trialPolicyVersion: string,
  ) {}

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const response = await fetch(`${this.supabaseUrl}/functions/v1/create-stripe-checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: this.authHeader,
      },
      body: JSON.stringify({
        planId: input.planId,
        billingCycle: input.billingCycle,
        source: input.source ?? "hybrid_billing",
        offerId: input.offerId ?? null,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.details || payload?.error || "stripe_checkout_failed");
    }

    return {
      provider: this.provider,
      url: payload.url,
      checkoutId: payload.sessionId ?? null,
      trialDurationDays: this.trialDurationDays,
      trialPolicyVersion: this.trialPolicyVersion,
    };
  }
}
