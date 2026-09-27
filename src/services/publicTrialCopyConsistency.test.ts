import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const visibleSource = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function collectFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir)).flatMap((entry) => {
    const relative = `${dir}/${entry}`;
    const absolute = resolve(root, relative);
    if (statSync(absolute).isDirectory()) return collectFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry) ? [relative] : [];
  });
}

const PUBLIC_UI_FILES = [
  ...collectFiles("src/components/landing"),
  ...collectFiles("src/components/subscription"),
  ...collectFiles("src/components/profile"),
  ...collectFiles("src/pages").filter((path) => !/\/Admin[^/]*\.tsx$/.test(path)),
  "src/config/plans.ts",
  "index.html",
];

describe("public Zuno trial copy", () => {
  it("does not hardcode a public seven-day offer anywhere in the user-facing UI", () => {
    for (const path of PUBLIC_UI_FILES) {
      expect(visibleSource(path), path).not.toMatch(/\b7\s*(?:dia|dias|day|days)\b|\bsete\s+dias\b/i);
    }
  });

  it("does not use em dash or en dash as user-facing punctuation", () => {
    for (const path of PUBLIC_UI_FILES) {
      expect(visibleSource(path), path).not.toMatch(/[—–]/);
    }
  });

  it("uses comma for the public city and state examples", () => {
    const copy = PUBLIC_UI_FILES.map(visibleSource).join("\n");
    expect(copy).not.toMatch(/\b(?:Campinas|Goiânia|Belo Horizonte|Curitiba|Ribeirão Preto)\s+-\s+[A-Z]{2}\b/);
    expect(copy).toContain("Goiânia, GO");
  });

  it("shares the canonical billing offer config across the app and Stripe provider", () => {
    const hook = source("src/hooks/useBillingOfferConfig.ts");
    const app = source("src/App.tsx");
    const stripeCheckout = source("supabase/functions/create-stripe-checkout/index.ts");

    expect(hook).toContain("BillingOfferProvider");
    expect(hook).toContain("trialDays: days");
    expect(hook).not.toContain("trialDurationDays: 7");
    expect(app).toContain("<BillingOfferProvider>");
    expect(stripeCheckout).toContain("trial_period_days: stripeTrialDurationDays");
    expect(stripeCheckout).not.toContain("trial_period_days: 7");
  });
});
