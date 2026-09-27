import type { BillingCheckoutInput, BillingCheckoutResult, BillingProviderAdapter } from "./types.ts";

export class StripeAdapter implements BillingProviderAdapter {
  readonly provider = "stripe" as const;

  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
    private readonly authHeader: string,
    private readonly trialDurationDays: number,
    private readonly trialPolicyVersion: string,
  ) {}

  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const conversionPath = input.conversionPath ?? "trial";
    const response = await fetch(`${this.supabaseUrl}/functions/v1/create-stripe-checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: this.authHeader,
        apikey: this.anonKey,
      },
      body: JSON.stringify({
        planId: input.planId,
        billingCycle: input.billingCycle,
        source: input.source ?? "hybrid_billing",
        offerId: input.offerId ?? null,
        conversionPath,
        trialDurationDays: this.trialDurationDays,
        trialPolicyVersion: this.trialPolicyVersion,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.url) {
      const error = new Error(payload?.details || payload?.error || "stripe_checkout_failed");
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return {
      provider: this.provider,
      url: payload.url,
      checkoutId: payload.sessionId ?? null,
      trialDurationDays: conversionPath === "trial" ? this.trialDurationDays : 0,
      trialPolicyVersion: this.trialPolicyVersion,
      conversionPath,
    };
  }
}
