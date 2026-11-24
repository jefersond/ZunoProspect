import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  computeUsageForPeriodTransition,
  extractSubscriptionIdFromInvoice,
  extractSubscriptionPeriod,
  selectBestStripeSubscription,
  shouldAutoHealStripeSubscription,
} from "../../supabase/functions/_shared/billing/stripe-renewal-sync";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("Stripe Renewal Sync — Compatibilidade API 2025+ e Renovação 25/11", () => {
  it("extrai subscription_id de Invoice no formato clássico e no formato Stripe API 2025-03-31.basil+", () => {
    expect(
      extractSubscriptionIdFromInvoice({ subscription: "sub_classic_123" }),
    ).toBe("sub_classic_123");

    expect(
      extractSubscriptionIdFromInvoice({
        subscription: { id: "sub_expanded_456" },
      }),
    ).toBe("sub_expanded_456");

    expect(
      extractSubscriptionIdFromInvoice({
        parent: {
          type: "subscription_details",
          subscription_details: {
            subscription: "sub_basil_parent_789",
          },
        },
      }),
    ).toBe("sub_basil_parent_789");

    expect(
      extractSubscriptionIdFromInvoice({
        lines: {
          data: [
            {
              parent: {
                type: "subscription_item_details",
                subscription_item_details: {
                  subscription: "sub_basil_line_999",
                },
              },
            },
          ],
        },
      }),
    ).toBe("sub_basil_line_999");

    expect(extractSubscriptionIdFromInvoice({})).toBeNull();
  });

  it("extrai período da assinatura sem lançar RangeError mesmo quando raiz está ausente (API 2025+)", () => {
    const startSec = Math.floor(Date.parse("2026-11-25T09:20:07Z") / 1000);
    const endSec = Math.floor(Date.parse("2026-12-25T09:20:07Z") / 1000);

    const fromRoot = extractSubscriptionPeriod({
      current_period_start: startSec,
      current_period_end: endSec,
    });
    expect(fromRoot.source).toBe("subscription_root");
    expect(fromRoot.periodStartIso).toBe("2026-11-25T09:20:07.000Z");
    expect(fromRoot.periodEndIso).toBe("2026-12-25T09:20:07.000Z");

    const fromItem = extractSubscriptionPeriod({
      items: {
        data: [
          {
            current_period_start: startSec,
            current_period_end: endSec,
          },
        ],
      },
    });
    expect(fromItem.source).toBe("subscription_item");
    expect(fromItem.periodStartIso).toBe("2026-11-25T09:20:07.000Z");
    expect(fromItem.periodEndIso).toBe("2026-12-25T09:20:07.000Z");

    const fromInvoice = extractSubscriptionPeriod(
      {},
      {
        invoice: {
          lines: {
            data: [{ period: { start: startSec, end: endSec } }],
          },
        },
      },
    );
    expect(fromInvoice.source).toBe("invoice_line");
    expect(fromInvoice.periodStartIso).toBe("2026-11-25T09:20:07.000Z");
    expect(fromInvoice.periodEndIso).toBe("2026-12-25T09:20:07.000Z");

    const fallback = extractSubscriptionPeriod(
      {},
      { billingCycle: "monthly", now: new Date("2026-11-25T09:20:07.000Z") },
    );
    expect(fallback.source).toBe("fallback");
    expect(fallback.periodStartIso).toBe("2026-11-25T09:20:07.000Z");
    expect(fallback.periodEndIso).toBe("2026-12-25T09:20:07.000Z");
  });

  it("reseta uso mensal na virada de ciclo pago (renovação 25/11) e preserva uso em replay idempotente", () => {
    const staleSubscriberBeforeRenewal = {
      leads_used_this_month: 245,
      ai_used_this_month: 32,
      current_period_start: "2026-06-18T09:20:11.140Z",
      current_period_end: "2026-07-18T09:20:11.140Z",
      subscription_status: "active",
      stripe_subscription_id: "sub_pro_renewal_25_11",
    };

    const renewed = computeUsageForPeriodTransition(
      staleSubscriberBeforeRenewal,
      "2026-11-25T09:20:07.000Z",
      "active",
      "sub_pro_renewal_25_11",
    );
    expect(renewed).toEqual({ leadsUsed: 0, aiUsed: 0, resetForNewCycle: true });

    const alreadyInCurrentCycle = {
      leads_used_this_month: 40,
      ai_used_this_month: 8,
      current_period_start: "2026-11-25T09:20:07.000Z",
      current_period_end: "2026-12-25T09:20:07.000Z",
      subscription_status: "active",
      stripe_subscription_id: "sub_pro_renewal_25_11",
    };

    const replayed = computeUsageForPeriodTransition(
      alreadyInCurrentCycle,
      "2026-11-25T09:20:07.000Z",
      "active",
      "sub_pro_renewal_25_11",
    );
    expect(replayed).toEqual({ leadsUsed: 40, aiUsed: 8, resetForNewCycle: false });

    const pastDueEvent = computeUsageForPeriodTransition(
      staleSubscriberBeforeRenewal,
      "2026-11-25T09:20:07.000Z",
      "past_due",
      "sub_pro_renewal_25_11",
    );
    expect(pastDueEvent).toEqual({ leadsUsed: 245, aiUsed: 32, resetForNewCycle: false });
  });

  it("prioriza active > trialing > past_due e impede downgrade indevido de past_due para Free", () => {
    const onlyPastDue = selectBestStripeSubscription([
      { id: "sub_canceled", status: "canceled", created: 200 },
      { id: "sub_past_due", status: "past_due", created: 100 },
    ]);
    expect(onlyPastDue?.id).toBe("sub_past_due");

    const activeBeatsPastDue = selectBestStripeSubscription([
      { id: "sub_past_due", status: "past_due", created: 300 },
      { id: "sub_active", status: "active", created: 200 },
      { id: "sub_trial", status: "trialing", created: 400 },
    ]);
    expect(activeBeatsPastDue?.id).toBe("sub_active");

    const allCanceled = selectBestStripeSubscription([
      { id: "sub_c1", status: "canceled", created: 100 },
      { id: "sub_c2", status: "incomplete_expired", created: 200 },
    ]);
    expect(allCanceled).toBeNull();
  });

  it("aciona auto-healing para trial vencido e para assinatura Stripe ativa/past_due com período local defasado", () => {
    const now = new Date("2026-11-24T18:00:00Z");

    expect(
      shouldAutoHealStripeSubscription(
        {
          billing_provider: "stripe",
          subscription_status: "active",
          current_period_end: "2026-07-18T09:20:11Z",
        },
        now,
      ),
    ).toBe(true);

    expect(
      shouldAutoHealStripeSubscription(
        {
          billing_provider: "stripe",
          subscription_status: "active",
          current_period_end: "2026-12-10T22:56:31Z",
        },
        now,
      ),
    ).toBe(false);

    expect(
      shouldAutoHealStripeSubscription(
        {
          billing_provider: "stripe",
          subscription_status: "past_due",
          current_period_end: "2026-11-10T22:56:31Z",
        },
        now,
      ),
    ).toBe(true);

    expect(
      shouldAutoHealStripeSubscription(
        {
          billing_provider: "mercado_pago",
          subscription_status: "active",
          current_period_end: "2026-07-18T09:20:11Z",
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("Blindagem de Segurança Stripe — .tmp/, Workflow e Edge Functions", () => {
  it("não mantém nenhum arquivo temporário rastreado sob .tmp/", () => {
    const trackedTmp = execFileSync("git", ["ls-files", "--", ".tmp"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    expect(trackedTmp).toBe("");
  });

  it("nenhuma Edge Function referencia o segredo duplicado Stripe_secret_key_nova", () => {
    const functionsDir = path.join(REPO_ROOT, "supabase", "functions");
    const walk = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(full));
        else if (entry.isFile() && /\.(ts|js|mjs|cjs)$/.test(entry.name)) files.push(full);
      }
      return files;
    };

    const hits: string[] = [];
    for (const file of walk(functionsDir)) {
      const content = fs.readFileSync(file, "utf8");
      if (/stripe_secret_key_nova/i.test(content)) {
        hits.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("reforça o workflow stripe-secret-guard.yml contra .tmp/, sk_live_, rk_live_ e whsec_", () => {
    const workflow = fs.readFileSync(
      path.join(REPO_ROOT, ".github", "workflows", "stripe-secret-guard.yml"),
      "utf8",
    );
    expect(workflow).toContain("git ls-files -- .tmp");
    expect(workflow).toContain("stripe-live-key");
    expect(workflow).toContain("stripe-webhook-secret");
    expect(workflow).toContain("whsec_");
    expect(workflow).toContain("never print matched text or credential values");
  });

  it("stripe-webhook e check-subscription usam helpers seguros de renovação e idempotência", () => {
    const webhookSrc = fs.readFileSync(
      path.join(REPO_ROOT, "supabase", "functions", "stripe-webhook", "index.ts"),
      "utf8",
    );
    expect(webhookSrc).toContain("extractSubscriptionIdFromInvoice");
    expect(webhookSrc).toContain("extractSubscriptionPeriod");
    expect(webhookSrc).toContain("computeUsageForPeriodTransition");
    expect(webhookSrc).toContain('eq("provider_event_id", event.id)');
    expect(webhookSrc).toContain('billing_provider: "stripe"');
    expect(webhookSrc).toContain("stripe_price_id: resolvedStripePriceId");

    const checkSubSrc = fs.readFileSync(
      path.join(REPO_ROOT, "supabase", "functions", "check-subscription", "index.ts"),
      "utf8",
    );
    expect(checkSubSrc).toContain("selectBestStripeSubscription");
    expect(checkSubSrc).toContain("extractSubscriptionPeriod");
    expect(checkSubSrc).toContain("stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)");
  });
});
