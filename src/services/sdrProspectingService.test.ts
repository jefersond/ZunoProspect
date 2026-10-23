if (!process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "mock-anon-key";
}

import { describe, it, expect } from "vitest";
import {
  sanitizeBrazilianPhoneNumber,
  generateSdrFirstApproachMessage,
} from "./sdrProspectingService";

describe("sdrProspectingService - Regras Comerciais e Sanitização", () => {
  it("deve sanitizar números brasileiros com 11 dígitos (celular) e adicionar DDI 55", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
    expect(res.formattedDisplay).toBe("(27) 99999-8888");
  });

  it("deve sanitizar números que já possuem 55 sem duplicar o prefixo", () => {
    const res = sanitizeBrazilianPhoneNumber("+55 27 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
  });

  it("deve reconhecer telefones fixos de 10 dígitos (sem marcar como celular)", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 3322-1100");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(false);
    expect(res.cleanNumber).toBe("552733221100");
  });

  it("deve retornar vazio para números inválidos ou nulos", () => {
    const res1 = sanitizeBrazilianPhoneNumber(null);
    expect(res1.isValid).toBe(false);
    expect(res1.cleanNumber).toBe("");

    const res2 = sanitizeBrazilianPhoneNumber("123");
    expect(res2.isValid).toBe(false);
    expect(res2.cleanNumber).toBe("");
  });

  it("deve gerar mensagem consultiva usando dados reais da empresa sem inventar fatos", () => {
    const lead = {
      nome: "Clínica Sorriso",
      cidade: "Vila Velha",
      nicho: "clínica odontológica",
      telefone: "(27) 99888-7766",
      website: "https://sorriso.com.br",
      rating: 4.9,
      total_reviews: 24,
      sinais: {
        has_whatsapp_on_site: true,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
    };

    const result = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "gestão de tráfego",
      style: "consultivo",
    });

    expect(result.text).toContain("Oi, Clínica Sorriso!");
    expect(result.text).toContain("Vila Velha");
    expect(result.text).toContain("4.9 estrelas em 24 avaliações");
    expect(result.text).toContain("gestão de tráfego");
    expect(result.whatsappUrl).toContain("https://wa.me/5527998887766");
    expect(result.whatsappUrl).toContain(encodeURIComponent("Oi, Clínica Sorriso!"));
  });

  it("NÃO deve inventar avaliações ou site se a empresa não possuir", () => {
    const leadSemSiteOuReviews = {
      nome: "Boutique Bella",
      cidade: "Vitória",
      nicho: "moda feminina",
      telefone: "27991112233",
      website: null,
      rating: null,
      total_reviews: 0,
      sinais: {
        has_whatsapp_on_site: false,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
    };

    const result = generateSdrFirstApproachMessage({
      lead: leadSemSiteOuReviews,
      userServiceName: "criação de catálogo e anúncios",
      style: "consultivo",
    });

    // Não deve inventar avaliações inexistentes
    expect(result.text).not.toContain("estrelas em");
    expect(result.text).not.toContain("Encontrei o site");
    expect(result.text).toContain("Oi, Boutique Bella!");
    expect(result.text).toContain("Vitória");
  });

  it("deve gerar estilo direto objetivo sem promessas agressivas", () => {
    const lead = {
      nome: "Advocacia Silva",
      cidade: "Serra",
      nicho: "escritório de advocacia",
      telefone: "27992223344",
      website: "https://advsilva.com.br",
    };

    const result = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "captação de clientes locais",
      style: "direto",
    });

    expect(result.text).toContain("Oi, Advocacia Silva! Tudo bem?");
    expect(result.text).toContain("Quem é a pessoa responsável pelo comercial ou marketing");
    expect(result.text).toContain("demonstração rápida de 1 minuto");
  });
});
