import { describe, expect, it } from "vitest";
import {
  dateKeyInTimeZone,
  formatTrialDate,
  normalizeBillingCycle,
  trialDaysRemaining,
  trialPriceSummary,
} from "./trialActivation";

describe("trial activation helpers", () => {
  it("formats the charge date in America/Sao_Paulo instead of UTC", () => {
    expect(dateKeyInTimeZone("2026-09-25T01:30:00Z")).toBe("2026-09-24");
    expect(formatTrialDate("2026-09-25T01:30:00Z")).toBe("24/09/2026");
  });

  it("calculates remaining calendar days in the trial timezone", () => {
    expect(trialDaysRemaining("2026-10-01T02:30:00Z", new Date("2026-09-24T21:00:00Z"))).toBe(6);
  });

  it("uses the real plan price and billing cycle", () => {
    expect(normalizeBillingCycle("yearly")).toBe("annual");
    expect(trialPriceSummary("pro", "monthly")).toMatchObject({ price: 97, periodLabel: "/mês" });
    expect(trialPriceSummary("agency", "annual")).toMatchObject({ price: 2470, periodLabel: "/ano" });
  });
});
