import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const visibleSource = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PUBLIC_COPY_FILES = [
  "src/components/landing/HeroSection.tsx",
  "src/components/landing/CTAFinalSection.tsx",
  "src/components/landing/PrecosSection.tsx",
  "src/components/landing/FAQSection.tsx",
  "src/components/landing/ComoFuncionaSection.tsx",
  "src/components/landing/CasosDeUsoSection.tsx",
  "src/components/landing/StatsSection.tsx",
  "src/components/landing/StickyCtaBar.tsx",
  "src/components/landing/data.ts",
  "src/components/landing/ParaQuemSection.tsx",
  "src/components/landing/CheckoutDialog.tsx",
  "src/pages/Checkout.tsx",
  "src/pages/Auth.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/Profile.tsx",
  "src/components/subscription/TrialActivationPanel.tsx",
  "src/config/plans.ts",
  "index.html",
];

describe("public Zuno trial copy", () => {
  it("does not hardcode a public seven-day offer", () => {
    for (const path of PUBLIC_COPY_FILES) {
      expect(visibleSource(path), path).not.toMatch(/\b7\s*(?:dia|dias|day|days)\b|\bsete\s+dias\b/i);
    }
  });

  it("does not use em dash or en dash as public punctuation", () => {
    for (const path of PUBLIC_COPY_FILES) {
      expect(visibleSource(path), path).not.toMatch(/[—–]/);
    }
  });

  it("uses comma for city and state examples", () => {
    const copy = PUBLIC_COPY_FILES.map(visibleSource).join("\n");
    expect(copy).not.toMatch(/\b(?:Campinas|Goiânia|Belo Horizonte|Curitiba|Ribeirão Preto)\s+-\s+[A-Z]{2}\b/);
    expect(copy).toContain("Goiânia, GO");
  });

  it("shares the canonical billing offer config across the app", () => {
    const hook = source("src/hooks/useBillingOfferConfig.ts");
    const app = source("src/App.tsx");
    const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");

    expect(hook).toContain("BillingOfferProvider");
    expect(hook).toContain("trialDays: days");
    expect(hook).not.toContain("trialDurationDays: 7");
    expect(app).toContain("<BillingOfferProvider>");
    expect(stripeCheckout).toContain("trial_period_days: stripeTrialDurationDays");
  });
});
