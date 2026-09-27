import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const publicCopyFiles = [
  "index.html",
  "src/components/landing/HeroSection.tsx",
  "src/components/landing/ProductProofSection.tsx",
  "src/components/landing/AntesDepoisSection.tsx",
  "src/components/landing/ParaQuemSection.tsx",
  "src/components/landing/StatsSection.tsx",
  "src/components/landing/ComoFuncionaSection.tsx",
  "src/components/landing/ParaQuemSection.tsx",
  "src/components/landing/CasosDeUsoSection.tsx",
  "src/components/landing/PrecosSection.tsx",
  "src/components/landing/CTAFinalSection.tsx",
  "src/components/landing/StickyCtaBar.tsx",
  "src/components/landing/mockups/MockupHeroProspeccao.tsx",
  "src/components/landing/data.ts",
  "src/pages/Checkout.tsx",
  "src/config/plans.ts",
];

describe("public trial copy consistency", () => {
  it("uses billing-offer-config as the public trial source of truth", () => {
    const hook = source("src/hooks/useBillingOfferConfig.ts");
    expect(hook).toContain('supabase.functions.invoke("billing-offer-config"');
    expect(hook).toContain("trialDurationDays: null");
    expect(hook).not.toContain("trialDurationDays: 7");
    expect(hook).not.toContain("trialDurationDays: 4");
  });

  it("has no hardcoded public seven-day trial copy", () => {
    for (const path of publicCopyFiles) {
      const text = source(path);
      expect(text, path).not.toMatch(/\b7\s+dias?\b|sete dias|7-day|7 days/i);
    }
  });

  it("keeps plan copy dynamic instead of hardcoding the current duration", () => {
    const plans = source("src/config/plans.ts");
    expect(plans).toContain("Plano de prospecção de {trialDays} dias");
    expect(plans).toContain("resolveTrialDaysCopy");
  });

  it("removes dash punctuation from the confirmed public copy", () => {
    const joined = publicCopyFiles.map(source).join("\n");
    expect(joined).not.toContain(" — ");
    expect(joined).not.toContain(" – ");
    expect(joined).not.toContain("Goiânia - GO");
    expect(joined).not.toContain("São Paulo - SP");
    expect(joined).toContain("Goiânia, GO");
    expect(source("index.html")).not.toContain("Zuno Propect - Prospecção B2B com IA");
  });
});
