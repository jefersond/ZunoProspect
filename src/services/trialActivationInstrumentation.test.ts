import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical trial activation instrumentation", () => {
  const migration = source("supabase/migrations/20260924213000_trial_activation_event_idempotency.sql");
  const tracking = source("supabase/functions/track-event/index.ts");
  const search = source("supabase/functions/buscar-leads/index.ts");
  const stripe = source("supabase/functions/stripe-webhook/index.ts");
  const onboarding = source("src/components/subscription/TrialActivationPanel.tsx");

  it("makes durable milestones idempotent so refresh/retry cannot duplicate them", () => {
    expect(migration).toContain("app_events_dedupe_key_unique");
    expect(migration).toContain("where dedupe_key is not null");
    expect(tracking).toContain('error?.code === "23505"');
    expect(stripe).toContain('error?.code === "23505"');
  });

  it("records first_search from the real server search flow", () => {
    expect(search).toContain('eventName: "first_search"');
    expect(search).toContain("searchRunId");
    expect(search).toContain("search_started");
  });

  it("records first_results only when a real search returns leads", () => {
    expect(search).toContain("if (!isAdminUser && leadsDetails.length > 0)");
    expect(search).toContain('eventName: "first_results"');
    expect(search).toContain("returnedQuantity: leadsDetails.length");
  });

  it("requires owned lead + successful real search + positive returned quantity before first value", () => {
    expect(tracking).toContain('.eq("user_id", userId)');
    expect(tracking).toContain("lead.search_run_id");
    expect(tracking).toContain('search.status !== "success"');
    expect(tracking).toContain("Number(search.returned_quantity || 0) <= 0");
    expect(tracking).toContain('"first_value_reached"');
    expect(tracking).toContain('activation_evidence: "real_search_real_results_lead_opened"');
  });

  it("does not let the browser forge billing or first-value milestones", () => {
    for (const eventName of [
      "card_added",
      "trial_started",
      "first_search",
      "first_results",
      "first_value_reached",
      "trial_converted_to_paid",
      "trial_cancelled",
      "subscription_cancelled",
      "payment_failed",
    ]) {
      expect(tracking).toContain(`"${eventName}"`);
    }
    expect(tracking).toContain("SERVER_ONLY_PRODUCT_EVENTS.has(eventName)");
  });

  it("only tracks trial onboarding/return for a currently active trial", () => {
    expect(tracking).toContain('subscriptionStatus === "trialing"');
    expect(tracking).toContain('reason: "not_in_active_trial"');
    expect(tracking).toContain('reason: "same_trial_day"');
  });

  it("seeds pre-existing active trials into the owner funnel idempotently on first return", () => {
    expect(tracking).toContain('eventName: "trial_started"');
    expect(tracking).toContain('eventId: `trial_started:${subscriptionRef}`');
    expect(tracking).toContain('eventName: "card_added"');
    expect(tracking).toContain('eventId: `card_added:${subscriptionRef}`');
  });

  it("registers trial conversion only from a successful paid Stripe invoice after trial end", () => {
    expect(stripe).toContain("paidAfterTrial");
    expect(stripe).toContain('subscription.status === "active"');
    expect(stripe).toContain("Number(invoice.amount_paid || amount || 0) > 0");
    expect(stripe).toContain("event.created >= subscription.trial_end");
    expect(stripe).toContain('eventName: "trial_converted_to_paid"');
  });

  it("tracks trial/subscription cancellation without changing the existing cancellation flow", () => {
    expect(stripe).toContain('eventName: "trial_cancelled"');
    expect(stripe).toContain('eventName: "subscription_cancelled"');
    expect(stripe).toContain("stripe.subscriptions.cancel(subscription.id)");
    expect(stripe).toContain('"Subscription_Canceled"');
  });

  it("keeps payment failure distinct from paid conversion", () => {
    expect(stripe).toContain('const isFailed = event.type === "invoice.payment_failed"');
    expect(stripe).toContain('eventName: "payment_failed"');
    expect(stripe).toContain('paymentStatus: isFailed ? "failed" : "paid"');
    expect(stripe).toContain("if (paidAfterTrial)");
  });

  it("shows transparent trial terms and only real accumulated metrics", () => {
    expect(onboarding).toContain("seu trial atual tem");
    expect(onboarding).toContain("trial_end");
    expect(onboarding).toContain('from("search_logs")');
    expect(onboarding).toContain('from("leads")');
    expect(onboarding).toContain("resultados reais no trial");
    expect(onboarding).not.toContain("demo");
  });
});
