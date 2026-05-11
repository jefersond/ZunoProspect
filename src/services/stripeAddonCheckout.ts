import { supabase } from "@/integrations/supabase/client";
import { normalizeAddonId, type AddonId } from "@/config/addons";

export const STRIPE_ADDON_CHECKOUT_FUNCTION = "create-stripe-addon-checkout";

type CreateStripeAddonCheckoutArgs = {
  addonId: AddonId;
};

export async function createStripeAddonCheckout({ addonId }: CreateStripeAddonCheckoutArgs) {
  const normalizedAddonId = normalizeAddonId(addonId);

  if (!normalizedAddonId) {
    throw new Error("Complemento inválido para o checkout.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;

  console.log("Addon checkout auth debug:", {
    sessionExists: Boolean(session),
    sessionUserId: session?.user?.id,
    accessTokenExists: Boolean(session?.access_token),
    addonId: normalizedAddonId,
  });

  if (sessionError) {
    console.error("Erro ao obter sessão para add-on:", sessionError);
  }

  if (!session?.user || !session?.access_token) {
    const checkoutError = new Error("Entre novamente para continuar com o pagamento.");
    (checkoutError as Error & { status?: number }).status = 401;
    (checkoutError as Error & { title?: string }).title = "Sessão expirada";
    throw checkoutError;
  }

  const { data, error } = await supabase.functions.invoke(STRIPE_ADDON_CHECKOUT_FUNCTION, {
    body: { addonId: normalizedAddonId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error || !data?.url) {
    console.error("Erro create-stripe-addon-checkout:", {
      addonId: normalizedAddonId,
      userId: session.user.id,
      error,
      data,
    });

    const status = error?.context?.status;
    const message = status === 401
      ? "Sessão expirada. Faça login novamente."
      : data?.details || data?.error || error?.message || "Não foi possível iniciar o pagamento. Tente novamente.";
    const checkoutError = new Error(message);
    (checkoutError as Error & { status?: number }).status = status;
    throw checkoutError;
  }

  return data as { url: string };
}
