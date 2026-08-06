import { describe, expect, it } from "vitest";
import {
  computeProviderRetryDelay,
  hasProviderRetryBudget,
  parseRetryAfterSeconds,
  REFINE_PROVIDER_MIN_ATTEMPT_MS,
  REFINE_PROVIDER_TOTAL_BUDGET_MS,
} from "./refine-retry-policy.ts";

describe("refine provider retry policy", () => {
  it("respects a numeric Retry-After header instead of guessing a backoff", () => {
    const result = computeProviderRetryDelay(429, 1, "12", 0);
    expect(result.retryAfterSeconds).toBe(12);
    expect(result.delayMs).toBe(12_000);
  });

  it("caps Retry-After at 60s so a misbehaving provider can't stall the whole budget", () => {
    expect(parseRetryAfterSeconds("999", 5)).toBe(60);
  });

  it("falls back to bounded exponential backoff for 429 without a Retry-After header", () => {
    const attempt1 = computeProviderRetryDelay(429, 1, null, 0);
    const attempt2 = computeProviderRetryDelay(429, 2, null, 0);
    expect(attempt1.retryAfterSeconds).toBe(2);
    expect(attempt2.retryAfterSeconds).toBe(4);
  });

  it("uses a much shorter backoff ceiling for non-429 transient errors (5xx/408)", () => {
    const result = computeProviderRetryDelay(503, 3, null, 0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(4);
  });

  it("adds bounded jitter so concurrent retries do not stampede the provider together", () => {
    const low = computeProviderRetryDelay(429, 1, "5", 0);
    const high = computeProviderRetryDelay(429, 1, "5", 0.999);
    expect(high.delayMs).toBeGreaterThan(low.delayMs);
    expect(high.delayMs - low.delayMs).toBeLessThan(500);
  });

  it("denies another retry once it would not fit inside the remaining provider budget", () => {
    expect(hasProviderRetryBudget(6_000, 500)).toBe(true);
    expect(hasProviderRetryBudget(4_000, 500)).toBe(false);
  });

  it("keeps the total provider budget bounded well under the frontend client timeout", () => {
    // O timeout do cliente (src/services/refineWithAI.ts) é 70s; o orçamento do provedor
    // precisa deixar folga suficiente para scraping, autenticação e persistência.
    expect(REFINE_PROVIDER_TOTAL_BUDGET_MS).toBeLessThanOrEqual(50_000);
    expect(REFINE_PROVIDER_MIN_ATTEMPT_MS).toBeGreaterThan(0);
  });
});
