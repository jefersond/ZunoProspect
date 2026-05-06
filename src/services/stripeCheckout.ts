import { supabase } from "@/integrations/supabase/client";

export const STRIPE_CHECKOUT_FUNCTION = "create-stripe-checkout";

type CheckoutPlan = {
  nome?: string;
  planKey: string;
};

type CreateStripeCheckoutArgs = {
  selectedPlan: CheckoutPlan;
  leadsQuantity: number;
  billingCycle: "monthly" | "annual";
  price?: number;
};

export async function createStripeCheckout({
  selectedPlan,
  leadsQuantity,
  billingCycle,
  price,
}: CreateStripeCheckoutArgs) {
  const safeLeadsQuantity = Number(leadsQuantity);
  const safePrice = price === undefined ? undefined : Number(price);

  if (!selectedPlan?.planKey) {
    throw new Error("Plano inválido para o checkout.");
  }

  if (!Number.isFinite(safeLeadsQuantity) || safeLeadsQuantity <= 0) {
    throw new Error("Quantidade de leads inválida para o plano selecionado.");
  }

  if (safePrice !== undefined && (!Number.isFinite(safePrice) || Number.isNaN(safePrice))) {
    throw new Error("Preço inválido para o plano selecionado.");
  }

  const payload = {
    planKey: selectedPlan.planKey,
    leadsQty: safeLeadsQuantity,
    isAnual: billingCycle === "annual",
  };

  console.info("Iniciando checkout Stripe:", {
    functionName: STRIPE_CHECKOUT_FUNCTION,
    selectedPlan: {
      nome: selectedPlan.nome,
      planKey: selectedPlan.planKey,
    },
    leadsQuantity: safeLeadsQuantity,
    billingCycle,
    price: safePrice,
    priceId: null,
    payload,
  });

  const { data, error } = await supabase.functions.invoke(STRIPE_CHECKOUT_FUNCTION, {
    body: payload,
  });

  if (error || !data?.url) {
    console.error("Erro checkout:", {
      functionName: STRIPE_CHECKOUT_FUNCTION,
      selectedPlan: {
        nome: selectedPlan.nome,
        planKey: selectedPlan.planKey,
      },
      leadsQuantity: safeLeadsQuantity,
      billingCycle,
      price: safePrice,
      priceId: null,
      status: error?.context?.status,
      error,
      data,
    });

    const details = data?.details || data?.error || error?.message;
    throw new Error(details || "Falha ao gerar link de pagamento.");
  }

  return data as { url: string };
}
