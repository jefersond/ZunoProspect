/**
 * Configuração canônica oficial de WhatsApp do Zuno Propect.
 * Número de suporte oficial verificado: 5527999697246 (atualizado no commit 908e64c)
 */
export const ZUNO_OFFICIAL_WHATSAPP = "5527999697246";

/**
 * Mensagem pré-formatada para visitantes da Landing Page com dúvidas sobre a ferramenta.
 */
export const WHATSAPP_LANDING_HELP_MESSAGE =
  "Olá! Vim pelo site do Zuno Propect e gostaria de tirar uma dúvida sobre a ferramenta.";

/**
 * Mensagem pré-formatada para visitantes com dúvidas ou problemas na assinatura/cadastro.
 */
export const WHATSAPP_SUBSCRIPTION_HELP_MESSAGE =
  "Olá! Estou no site do Zuno Propect e preciso de ajuda com o cadastro ou assinatura.";

/**
 * Mensagem padrão de suporte para usuários autenticados no aplicativo.
 */
export const WHATSAPP_APP_SUPPORT_MESSAGE =
  "Olá! Preciso de suporte com o Zuno Prospect.";

/**
 * Horário de atendimento comercial (horário de Brasília)
 */
export const WHATSAPP_BUSINESS_HOURS = {
  openingHour: 8,
  closingHour: 18,
  weekdaysOnly: true,
} as const;

/**
 * Constrói o link oficial https://wa.me/ com mensagem pré-preenchida.
 * O visitante precisa confirmar o envio; nenhum envio automático é realizado.
 */
export function buildWhatsAppUrl(
  message: string = WHATSAPP_LANDING_HELP_MESSAGE,
  phone: string = ZUNO_OFFICIAL_WHATSAPP
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
