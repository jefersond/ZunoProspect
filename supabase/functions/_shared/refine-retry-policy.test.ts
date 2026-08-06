import { describe, expect, it } from "vitest";
import {
  computeProviderRetryDelay,
  hasProviderRetryBudget,
  parseRetryAfterSeconds,
} from "./refine-retry-policy.ts";

describe("refine provider retry policy", () => {
  it("honors numeric Retry-After and adds bounded jitter", () => {
    expect(computeProviderRetryDelay(429, 1, "12", 0.5)).toEqual({
      retryAfterSeconds: 12,
      delayMs: 12_250,
    });
  });

  it("honors an HTTP-date Retry-After", () => {
    const now = Date.parse("2026-07-26T12:00:00.000Z");
    expect(parseRetryAfterSeconds("Sun, 26 Jul 2026 12:00:08 GMT", 2, now)).toBe(8);
  });

  it("uses exponential fallback when Retry-After is absent", () => {
    expect(computeProviderRetryDelay(429, 1, null, 0)).toEqual({ retryAfterSeconds: 2, delayMs: 2_000 });
    expect(computeProviderRetryDelay(429, 2, null, 0)).toEqual({ retryAfterSeconds: 4, delayMs: 4_000 });
  });

  it("does not start another attempt without remaining time", () => {
    expect(hasProviderRetryBudget(10_000, 4_500)).toBe(true);
    expect(hasProviderRetryBudget(9_000, 4_500)).toBe(false);
  });
});