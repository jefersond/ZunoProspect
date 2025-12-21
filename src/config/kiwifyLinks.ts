// Links de checkout da Kiwify para cada plano
export const KIWIFY_CHECKOUT_LINKS = {
  iniciante_mensal: "https://pay.kiwify.com.br/tI84kVd",
  iniciante_anual: "https://pay.kiwify.com.br/PhCzSuq",
  pro_mensal: "https://pay.kiwify.com.br/7effc7Q",
  pro_anual: "https://pay.kiwify.com.br/81bPEL2",
  agencia_mensal: "https://pay.kiwify.com.br/8r3UXxM",
  agencia_anual: "https://pay.kiwify.com.br/Rk36gTd",
} as const;

export type KiwifyPlanKey = keyof typeof KIWIFY_CHECKOUT_LINKS;

/**
 * Retorna a URL de checkout da Kiwify para o plano selecionado
 * @param plano - Nome do plano (pro ou agencia)
 * @param isAnual - Se é plano anual
 * @param email - Email do usuário (opcional, pré-preenche no checkout)
 * @param name - Nome do usuário (opcional, pré-preenche no checkout)
 */
export function getKiwifyCheckoutUrl(
  plano: string, 
  isAnual: boolean, 
  email?: string, 
  name?: string
): string {
  // Normalizar o nome do plano (remover acentos e converter para minúsculas)
  const planoNormalizado = plano
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  const planKey = `${planoNormalizado}_${isAnual ? "anual" : "mensal"}` as KiwifyPlanKey;
  let url = KIWIFY_CHECKOUT_LINKS[planKey];
  
  if (!url) {
    // Fallback para Pro mensal se plano não encontrado
    url = KIWIFY_CHECKOUT_LINKS.pro_mensal;
  }
  
  // Adicionar parâmetros de email e nome se fornecidos
  const params = new URLSearchParams();
  if (email) params.append("email", email);
  if (name) params.append("name", name);
  
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
