import { supabase } from "@/integrations/supabase/client";
import { PLANS, normalizePlanId, type BillingCycle } from "@/config/plans";

export const STRIPE_CHECKOUT_FUNCTION = "create-stripe-checkout";

type CheckoutPlan = {
  nome?: string;
  planKey: string;
};

type CreateStripeCheckoutArgs = {
  selectedPlan: CheckoutPlan;
  leadsQuantity?: number;
  billingCycle?: BillingCycle;
  price?: number;
};

export async function createStripeCheckout({
  selectedPlan,
  billingCycle = "monthly",
}: CreateStripeCheckoutArgs) {
  const functionName = STRIPE_CHECKOUT_FUNCTION;
  const planId = normalizePlanId(selectedPlan?.planKey);

  if (!planId) {
    throw new Error("Plano inválido para o checkout.");
  }

  const plan = PLANS[planId];
  const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const unitAmount = price * 100;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;

  console.log("Checkout debug:", {
    functionName,
    userId: session?.user?.id,
    hasSession: Boolean(session),
    planId,
    billingCycle,
    sessionError: sessionError?.message,
  });

  if (sessionError || !session?.access_token) {
    const checkoutError = new Error("Faça login para continuar com o pagamento.");
    (checkoutError as Error & { status?: number }).status = 401;
    throw checkoutError;
  }

  const payload = {
    planId,
    billingCycle,
    price,
    unitAmount,
    leadsLimit: plan.leadsLimit,
    aiLimit: plan.aiLimit,
  };

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error || !data?.url) {
    console.error("Erro ao processar upgrade:", {
      functionName,
      userId: session.user.id,
      planId,
      billingCycle,
      error,
      data,
    });

    const status = error?.context?.status;
    const details = data?.details || data?.error || error?.message;
    const message = status === 401
      ? "Faça login para continuar com o pagamento."
      : details || "Não foi possível iniciar o pagamento. Verifique sua conta ou tente novamente.";
    const checkoutError = new Error(message);
    (checkoutError as Error & { status?: number }).status = status;
    throw checkoutError;
  }

  return data as { url: string };
}
