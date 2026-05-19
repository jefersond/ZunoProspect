import { supabase } from "@/integrations/supabase/client";
import { PLANS, normalizePlanId, type BillingCycle } from "@/config/plans";
import type { User } from "@supabase/supabase-js";

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
  authUserFromHook?: User | null;
};

export async function createStripeCheckout({
  selectedPlan,
  billingCycle = "monthly",
  authUserFromHook,
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
  const session = sessionData?.session;

  console.log("Checkout auth debug:", {
    authUserFromHook: Boolean(authUserFromHook),
    authUserIdFromHook: authUserFromHook?.id,
    sessionExists: Boolean(session),
    sessionUserId: session?.user?.id,
    accessTokenExists: Boolean(session?.access_token),
    planId,
    billingCycle,
  });

  if (sessionError) {
    console.error("Erro ao obter sessão:", sessionError);
  }

  if (!session?.user || !session?.access_token) {
    console.error("Checkout sem sessão válida:", {
      hasSession: Boolean(session),
      hasUser: Boolean(session?.user),
      hasAccessToken: Boolean(session?.access_token),
      sessionError: sessionError?.message,
    });

    const checkoutError = new Error("Entre novamente para continuar com o pagamento.");
    (checkoutError as Error & { status?: number }).status = 401;
    (checkoutError as Error & { title?: string }).title = "Sessão expirada";
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
    console.error("Erro create-stripe-checkout:", {
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
      ? "Sessão expirada. Faça login novamente."
      : details || "Não foi possível iniciar o pagamento. Tente novamente.";
    const checkoutError = new Error(message);
    (checkoutError as Error & { status?: number }).status = status;
    throw checkoutError;
  }

  return data as { url: string; sessionId?: string };
}
