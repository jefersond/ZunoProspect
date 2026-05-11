// Links de checkout da Kiwify para fluxos legados de planos.
// O complemento EUA usa Stripe via create-stripe-addon-checkout.
export const KIWIFY_CHECKOUT_LINKS = {
  iniciante_mensal: "https://pay.kiwify.com.br/tI84kVd",
  iniciante_anual: "https://pay.kiwify.com.br/PhCzSuq",
  pro_mensal: "https://pay.kiwify.com.br/7effc7Q",
  pro_anual: "https://pay.kiwify.com.br/81bPEL2",
  agencia_mensal: "https://pay.kiwify.com.br/8r3UXxM",
  agencia_anual: "https://pay.kiwify.com.br/Rk36gTd",
} as const;

export type KiwifyPlanKey = keyof typeof KIWIFY_CHECKOUT_LINKS;

export function getKiwifyCheckoutUrl(
  plano: string,
  isAnual: boolean,
  email?: string,
  name?: string,
  leadsQty?: number,
): string {
  const planoNormalizado = plano
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const planKey = `${planoNormalizado}_${isAnual ? "anual" : "mensal"}` as KiwifyPlanKey;
  let url = KIWIFY_CHECKOUT_LINKS[planKey];

  if (!url) {
    url = KIWIFY_CHECKOUT_LINKS.pro_mensal;
  }

  const params = new URLSearchParams();
  if (email) params.append("email", email);
  if (name) params.append("name", name);
  if (leadsQty) params.append("leads", leadsQty.toString());

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
