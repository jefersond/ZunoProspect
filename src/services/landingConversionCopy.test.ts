import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTrialCtaLabel } from "@/components/landing/ctaStyles";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("landing conversion copy", () => {
  it("makes the first screen answer what Zuno is, what it does and what to do next", () => {
    const hero = source("src/components/landing/HeroSection.tsx");
    expect(hero).toContain("Plataforma de prospecção B2B");
    expect(hero).toContain("Encontre empresas que podem se tornar seus próximos clientes.");
    expect(hero).toContain("Pesquise negócios por cidade e segmento, descubra oportunidades e organize sua prospecção em um só lugar.");
    expect(hero).toContain("getTrialCtaLabel(trialDurationDays)");
    expect(hero).toContain("hero_cta_clicked");
    expect(hero).toContain("trial_cta_clicked");
    expect(hero).toContain("trialDurationDays");
  });

  it("puts product proof immediately after the hero and keeps fake social proof hidden", () => {
    const landing = source("src/pages/LandingProspeccaoIA.tsx");
    expect(landing.indexOf("<HeroSection />")).toBeLessThan(landing.indexOf("<ProductProofSection />"));
    expect(landing.indexOf("<ProductProofSection />")).toBeLessThan(landing.indexOf("<AntesDepoisSection />"));
    expect(landing).toContain("<SocialProofSection items={[]} />");
    expect(landing).not.toContain("<StatsSection />");
    expect(landing).not.toContain("<CasosDeUsoSection />");
    expect(landing).not.toContain("<ReferralSection />");

    const socialProof = source("src/components/landing/SocialProofSection.tsx");
    expect(socialProof).toContain("if (!items.length) return null");
  });

  it("keeps the product demo explicit and removes unsupported conversion claims", () => {
    const proof = source("src/components/landing/ProductProofSection.tsx");
    const how = source("src/components/landing/ComoFuncionaSection.tsx");
    const problem = source("src/components/landing/AntesDepoisSection.tsx");
    const joined = [proof, how, problem].join("\n");

    expect(proof).toContain("Exemplo demonstrativo");
    expect(proof).toContain("Resultado ilustrativo da pesquisa");
    expect(proof).toContain("Cidade escolhida: Ribeirão Preto, SP");
    expect(proof).toContain("Segmento pesquisado: clínicas odontológicas");
    expect(proof).toContain("não dispara mensagens automaticamente");
    expect(joined).not.toContain("menos de 5 minutos");
    expect(joined).not.toContain("alta taxa de resposta");
    expect(joined).not.toContain("92% Match");
    expect(joined).not.toContain("78% Match");
  });

  it("keeps the CTA duration aligned with the active billing offer", () => {
    expect(getTrialCtaLabel(7)).toBe("Começar meu teste de 7 dias");
    expect(getTrialCtaLabel(4)).toBe("Começar meu teste de 4 dias");
    expect(getTrialCtaLabel(null)).toBe("Começar meu teste");
  });

  it("does not count the header CTA as a second pricing navigation click", () => {
    const header = source("src/components/landing/LPHeader.tsx");
    expect(header).toContain('id === "precos" && trackNavigation');
    expect(header.match(/scrollToSection\("precos", false\)/g)).toHaveLength(2);
  });

  it("uses commercial objections in the requested order", () => {
    const data = source("src/components/landing/data.ts");
    const questions = [
      "Isso é diferente do Google Maps?",
      "Os dados são atuais?",
      "Preciso saber prospectar?",
      "O Zuno envia mensagens sozinho?",
      "Preciso cadastrar cartão?",
      "Quando começa a cobrança?",
      "Posso cancelar antes?",
      "Quais dados públicos são utilizados?",
    ];

    for (let index = 0; index < questions.length - 1; index += 1) {
      expect(data.indexOf(questions[index])).toBeLessThan(data.indexOf(questions[index + 1]));
    }
  });

  it("keeps plan positioning factual and funnel events reusable", () => {
    const plans = source("src/config/plans.ts");
    const pricing = source("src/components/landing/PrecosSection.tsx");
    const landing = source("src/pages/LandingProspeccaoIA.tsx");
    const auth = source("src/pages/Auth.tsx");

    expect(plans).toContain("Para começar a prospectar sozinho.");
    expect(plans).toContain("Para quem prospecta toda semana.");
    expect(plans).toContain("Para equipes que precisam de volume.");
    expect(pricing).toContain("Melhor para uso recorrente");
    expect(landing).toContain('trackEvent("landing_viewed"');
    expect(pricing).toContain('trackEvent("pricing_viewed"');
    expect(pricing).toContain('trackEvent("plan_selected"');
    expect(pricing).toContain('trackEvent("trial_cta_clicked"');
    expect(auth).toContain('trackEvent("signup_started"');
  });
});
