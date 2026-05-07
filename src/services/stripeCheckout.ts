import { supabase } from "@/integrations/supabase/client";

export const STRIPE_CHECKOUT_FUNCTION = "create-stripe-checkout";

type PlanId = "starter" | "pro" | "agency";

type CheckoutPlan = {
  nome?: string;
  planKey: string;
};

type CreateStripeCheckoutArgs = {
  selectedPlan: CheckoutPlan;
  leadsQuantity?: number;
  billingCycle?: "monthly" | "annual";
  price?: number;
};

const PLANS: Record<PlanId, {
  price: number;
  unitAmount: number;
  leadsLimit: number;
  aiLimit: number;
}> = {
  starter: {
    price: 47,
    unitAmount: 4700,
    leadsLimit: 300,
    aiLimit: 30,
  },
  pro: {
    price: 97,
    unitAmount: 9700,
    leadsLimit: 800,
    aiLimit: 100,
  },
  agency: {
    price: 247,
    unitAmount: 24700,
    leadsLimit: 2000,
    aiLimit: 300,
  },
};

function normalizePlanId(planKey: string | undefined): PlanId | null {
  const key = String(planKey || "").trim().toLowerCase();

  if (key === "iniciante") return "starter";
  if (key === "agencia") return "agency";
  if (key === "starter" || key === "pro" || key === "agency") return key;

  return null;
}

export async function createStripeCheckout({
  selectedPlan,
}: CreateStripeCheckoutArgs) {
  const functionName = STRIPE_CHECKOUT_FUNCTION;
  const planId = normalizePlanId(selectedPlan?.planKey);

  if (!planId) {
    throw new Error("Plano inválido para o checkout.");
  }

  const plan = PLANS[planId];
  const billingCycle = "monthly" as const;
  const payload = {
    planId,
    billingCycle,
    price: plan.price,
    unitAmount: plan.unitAmount,
    leadsLimit: plan.leadsLimit,
    aiLimit: plan.aiLimit,
  };

  console.info("Iniciando checkout Stripe:", {
    functionName,
    planId,
    billingCycle,
    price: plan.price,
    unitAmount: plan.unitAmount,
    payload,
  });

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error || !data?.url) {
    console.error("Erro ao processar upgrade:", {
      functionName,
      planId,
      billingCycle,
      price: plan.price,
      unitAmount: plan.unitAmount,
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
