import { describe, it, expect } from "vitest";
import {
  ZUNO_OFFICIAL_WHATSAPP,
  WHATSAPP_LANDING_HELP_MESSAGE,
  WHATSAPP_SUBSCRIPTION_HELP_MESSAGE,
  WHATSAPP_APP_SUPPORT_MESSAGE,
  WHATSAPP_BUSINESS_HOURS,
  buildWhatsAppUrl,
} from "@/config/whatsapp";
import { ZUNO_SUPPORT_WHATSAPP } from "@/utils/subscriptionHelpers";

describe("Atendimento via WhatsApp — Configuração e Conformidade", () => {
  it("deve usar o número oficial verificado do WhatsApp Business do Zuno (5527999697246)", () => {
    expect(ZUNO_OFFICIAL_WHATSAPP).toBe("5527999697246");
    expect(ZUNO_SUPPORT_WHATSAPP).toBe("5527999697246");
    expect(ZUNO_OFFICIAL_WHATSAPP).toMatch(/^55\d{11}$/);
  });

  it("deve conter a mensagem pré-preenchida exata para visitantes da Landing Page com dúvidas", () => {
    expect(WHATSAPP_LANDING_HELP_MESSAGE).toBe(
      "Olá! Vim pelo site do Zuno Prospect e gostaria de tirar uma dúvida sobre a ferramenta."
    );
  });

  it("deve conter a mensagem pré-preenchida exata para visitantes com dúvidas sobre assinatura", () => {
    expect(WHATSAPP_SUBSCRIPTION_HELP_MESSAGE).toBe(
      "Olá! Estou no site do Zuno Prospect e preciso de ajuda com o cadastro ou assinatura."
    );
  });

  it("deve construir a URL oficial https://wa.me/ corretamente com a mensagem pré-preenchida", () => {
    const urlLanding = buildWhatsAppUrl(WHATSAPP_LANDING_HELP_MESSAGE);
    expect(urlLanding).toBe(
      `https://wa.me/5527999697246?text=${encodeURIComponent(
        "Olá! Vim pelo site do Zuno Prospect e gostaria de tirar uma dúvida sobre a ferramenta."
      )}`
    );

    const urlAssinatura = buildWhatsAppUrl(WHATSAPP_SUBSCRIPTION_HELP_MESSAGE);
    expect(urlAssinatura).toBe(
      `https://wa.me/5527999697246?text=${encodeURIComponent(
        "Olá! Estou no site do Zuno Prospect e preciso de ajuda com o cadastro ou assinatura."
      )}`
    );
  });

  it("não deve permitir envio automático (a URL é puramente para abertura de chat nativo no WhatsApp)", () => {
    const url = buildWhatsAppUrl();
    expect(url.startsWith("https://wa.me/5527999697246?text=")).toBe(true);
    // Não deve conter parâmetros de auto-submit ou scripts
    expect(url).not.toContain("auto_send");
    expect(url).not.toContain("javascript:");
  });

  it("deve respeitar a política de não prometer atendimento 24 horas", () => {
    expect(WHATSAPP_BUSINESS_HOURS.openingHour).toBe(8);
    expect(WHATSAPP_BUSINESS_HOURS.closingHour).toBe(18);
    expect(WHATSAPP_BUSINESS_HOURS.weekdaysOnly).toBe(true);
  });
});
