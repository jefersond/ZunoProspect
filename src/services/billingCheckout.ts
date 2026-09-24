import { supabase } from "@/integrations/supabase/client";
import { normalizePlanId, type BillingCycle } from "@/config/plans";

export type BillingProvider = "stripe" | "mercado_pago";

export type BillingCheckoutResult = {
  provider: BillingProvider;
  url: string;
  checkoutId?: string | null;
  trialDurationDays: number;
  trialPolicyVersion: string;
};

type CheckoutPlan = {
  planKey: string;
};

type CreateBillingCheckoutArgs = {
  selectedPlan: CheckoutPlan;
  billingCycle?: BillingCycle;
  source?: string;
  offerId?: string | null;
};

interface BillingRedirectAdapter {
  readonly provider: BillingProvider;
  redirect(result: BillingCheckoutResult): void;
}

export class StripeAdapter implements BillingRedirectAdapter {
  readonly provider = "stripe" as const;
  redirect(result: BillingCheckoutResult) {
    window.location.assign(result.url);
  }
}

export class MercadoPagoAdapter implements BillingRedirectAdapter {
  readonly provider = "mercado_pago" as const;
  redirect(result: BillingCheckoutResult) {
    window.location.assign(result.url);
  }
}

export function billingRedirectAdapter(provider: BillingProvider): BillingRedirectAdapter {
  return provider === "mercado_pago" ? new MercadoPagoAdapter() : new StripeAdapter();
}

export async function createBillingCheckout({
  selectedPlan,
  billingCycle = "monthly",
  source,
  offerId,
}: CreateBillingCheckoutArgs): Promise<BillingCheckoutResult> {
  const planId = normalizePlanId(selectedPlan?.planKey);
  if (!planId) throw new Error("Plano inválido para o checkout.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session?.user || !session.access_token) {
    throw new Error("Entre novamente para continuar com o pagamento.");
  }

  const { data, error } = await supabase.functions.invoke("create-billing-checkout", {
    body: {
      planId,
      billingCycle,
      source: source || "web",
      offerId: offerId || null,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.url || !["stripe", "mercado_pago"].includes(data?.provider)) {
    throw new Error(data?.error || data?.details || error?.message || "Não foi possível iniciar o pagamento.");
  }

  return {
    provider: data.provider,
    url: data.url,
    checkoutId: data.checkoutId ?? null,
    trialDurationDays: Number(data.trialDurationDays || 0),
    trialPolicyVersion: String(data.trialPolicyVersion || ""),
  };
}
