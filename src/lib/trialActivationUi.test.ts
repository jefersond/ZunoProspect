import { describe, expect, it } from "vitest";
import { resolveTrialUiState, trialDurationDays, type TrialUiSubscription } from "./trialActivation";

const sub = (overrides: Partial<TrialUiSubscription> = {}): TrialUiSubscription => ({
  subscription_status: null,
  status: null,
  billing_provider: null,
  trial_start: null,
  trial_end: null,
  ...overrides,
});

describe("trial UI state contract", () => {
  it("handles billing loading before any subscription exists", () => {
    expect(resolveTrialUiState({ subscription: null, loading: true, error: null })).toBe("loading");
  });

  it("surfaces billing query errors instead of treating them as no subscription", () => {
    expect(resolveTrialUiState({ subscription: null, loading: false, error: "query_failed" })).toBe("error");
  });

  it("handles a user with no subscription", () => {
    expect(resolveTrialUiState({ subscription: null, loading: false, error: null })).toBe("none");
  });

  it("handles a Mercado Pago relation that has not created a subscription yet", () => {
    expect(resolveTrialUiState({
      subscription: sub({ billing_provider: "mercado_pago", subscription_status: "free" }),
      loading: false,
      error: null,
    })).toBe("none");
  });

  it("handles an active Stripe subscription", () => {
    expect(resolveTrialUiState({
      subscription: sub({ billing_provider: "stripe", subscription_status: "active" }),
      loading: false,
      error: null,
    })).toBe("active");
  });

  it("handles a cancelled Stripe subscription", () => {
    expect(resolveTrialUiState({
      subscription: sub({ billing_provider: "stripe", subscription_status: "cancelled" }),
      loading: false,
      error: null,
    })).toBe("cancelled");
  });

  it("handles an active trial", () => {
    expect(resolveTrialUiState({
      subscription: sub({
        billing_provider: "stripe",
        subscription_status: "trialing",
        trial_start: "2026-09-27T12:00:00Z",
        trial_end: "2026-10-01T12:00:00Z",
      }),
      loading: false,
      error: null,
    })).toBe("trialing");
  });

  it("does not fabricate trial dates when trial_start is null", () => {
    const subscription = sub({
      billing_provider: "mercado_pago",
      subscription_status: "trialing",
      trial_start: null,
      trial_end: "2026-10-01T12:00:00Z",
    });
    expect(resolveTrialUiState({ subscription, loading: false, error: null })).toBe("trialing");
    expect(trialDurationDays(subscription.trial_start, subscription.trial_end)).toBeNull();
  });

  it("does not fabricate trial dates when trial_end is null", () => {
    const subscription = sub({
      billing_provider: "stripe",
      subscription_status: "trialing",
      trial_start: "2026-09-27T12:00:00Z",
      trial_end: null,
    });
    expect(resolveTrialUiState({ subscription, loading: false, error: null })).toBe("trialing");
    expect(trialDurationDays(subscription.trial_start, subscription.trial_end)).toBeNull();
  });

  it("handles payment recovery states without crashing", () => {
    expect(resolveTrialUiState({
      subscription: sub({ billing_provider: "stripe", subscription_status: "past_due" }),
      loading: false,
      error: null,
    })).toBe("past_due");
  });
});
