import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DURATION_DAYS, TRIAL_POLICY_VERSION } from "@/config/trialPolicy";
import { trialDurationDays } from "@/lib/trialActivation";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

function operationalFiles(dir = root): string[] {
  const ignoredDirs = new Set([".git", ".tmp", "node_modules", "dist", "dist-ssr", ".vercel"]);
  const allowed = /\.(?:ts|tsx|js|jsx|sql|json|html|toml|ya?ml)$/i;
  const result: string[] = [];

  for (const name of readdirSync(dir)) {
    if (ignoredDirs.has(name)) continue;
    const absolute = join(dir, name);
    const rel = relative(root, absolute).replaceAll("\\", "/");
    const stat = statSync(absolute);
    if (stat.isDirectory()) result.push(...operationalFiles(absolute));
    else if (allowed.test(name)) result.push(rel);
  }

  return result;
}

describe("four-day trial policy", () => {
  const checkout = source("supabase/functions/create-stripe-checkout/index.ts");
  const webhook = source("supabase/functions/stripe-webhook/index.ts");
  const checkSubscription = source("supabase/functions/check-subscription/index.ts");
  const dashboard = source("src/pages/Dashboard.tsx");
  const activationPanel = source("src/components/subscription/TrialActivationPanel.tsx");

  it("has one canonical rule for new trials", () => {
    expect(TRIAL_DURATION_DAYS).toBe(4);
    expect(TRIAL_POLICY_VERSION).toBe("4d_2026_09");
    expect(checkout).toContain("trial_period_days: TRIAL_DURATION_DAYS");
    expect(checkout).toContain("trial_duration_days: String(TRIAL_DURATION_DAYS)");
    expect(checkout).toContain("trial_policy_version: TRIAL_POLICY_VERSION");
    expect(checkout).not.toMatch(/trial_period_days\s*:\s*7\b/);
  });

  it("preserves an existing seven-day trial end instead of recalculating it", () => {
    expect(trialDurationDays("2026-09-01T12:00:00Z", "2026-09-08T12:00:00Z")).toBe(7);
    expect(webhook).toContain("trialEnd = subscription.trial_end");
    expect(checkSubscription).toContain("trialEnd = subscription.trial_end");
    expect(webhook).not.toMatch(/trialEnd\s*=\s*.*TRIAL_DURATION_DAYS/);
    expect(webhook).not.toContain("trial_period_days");
  });

  it("does not extend a trial on webhook retry or refresh", () => {
    expect(webhook).toContain("checkDuplicateTrialStartedEvent");
    expect(webhook).toContain("dedupe_key: dedupeKey || null");
    expect(checkSubscription).not.toContain("trial_period_days");
    expect(checkSubscription).not.toMatch(/setDate\([^\n]*\+\s*4/);
  });

  it("uses Stripe-backed trial_end for post-start charge dates", () => {
    expect(dashboard).toContain("formatTrialDate(subscription.trial_end)");
    expect(activationPanel).toContain("formatTrialDate(subscription.trial_end)");
    expect(dashboard).toContain("trialPriceSummary(subscription?.plan_name, subscription?.billing_cycle)");
  });

  it("records cohort policy and the day first value happened", () => {
    const tracking = source("supabase/functions/track-event/index.ts");
    expect(webhook).toContain("trial_duration_days");
    expect(webhook).toContain("trial_policy_version");
    expect(tracking).toContain("trial_day:");
    expect(tracking).toContain("trialDayIndex");
  });

  it("records only provider-supplied payment failure codes", () => {
    expect(webhook).toContain("last_payment_error");
    expect(webhook).toContain("failure_code: providerFailureCode");
    expect(webhook).toContain("decline_code: providerDeclineCode");
    expect(webhook).toContain('"first_charge_attempt"');
    expect(webhook).toContain('outcome: isFailed ? "failed" : "succeeded"');
    expect(webhook).not.toContain('failure_code: "insufficient_funds"');
    expect(webhook).not.toContain('decline_code: "card_declined"');
  });

  it("has no operational 7-day trial copy or hardcoded 7-day billing rule", () => {
    const allowlistedBlockedOrHistorical = new Set([
      "src/components/admin/BehaviorEmailsDashboard.tsx",
      "supabase/functions/process-behavior-emails/index.ts",
      "src/pages/AdminInstagram.tsx",
      "src/pages/AdminCommandCenter.tsx",
      "supabase/migrations/20260720223000_marketing_operations_team.sql",
    ]);
    const failures: string[] = [];

    for (const path of operationalFiles()) {
      if (path === "src/services/trialFourDayPolicy.test.ts") continue;
      const content = source(path);
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const trialContext = /(trial|teste|cart[aã]o|cobran[cç]|assinatur)/i.test(line);
        const sevenDays = /\b7\s*(?:dias?|days?|day)\b|seven\s+days|sete\s+dias/i.test(line);
        const hardcodedStripeRule = /trial_period_days\s*:\s*7\b|trial_days\s*:\s*["']7["']/i.test(line);
        const legacySeconds = /\b(?:604800|604800000|168h|168\s+hours|10080)\b/i.test(line)
          && /(trial|teste|checkout|stripe|subscription)/i.test(path + " " + line);

        if (hardcodedStripeRule || legacySeconds || (trialContext && sevenDays && !allowlistedBlockedOrHistorical.has(path))) {
          failures.push(`${path}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
