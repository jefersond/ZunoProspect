import { describe, expect, it } from "vitest";

describe("Mercado Pago sandbox doctor", () => {
  it("proves current credential is sandbox/test and API reachable", async () => {
    const r = await fetch("https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/mp-sandbox-doctor-temp?k=mp-e2e-20260928-a7c9f4");
    const body = await r.json();
    console.log("MP_SANDBOX_DOCTOR", JSON.stringify(body));
    expect(r.ok).toBe(true);
    expect(body.token_present).toBe(true);
    expect(body.webhook_secret_present).toBe(true);
    expect(body.api_ok).toBe(true);
    expect(String(body.nickname || "")).toMatch(/^TESTUSER/);
  }, 20000);

  it("creates a fresh Starter 4-day trial checkout only in sandbox", async () => {
    const r = await fetch("https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/mp-e2e-runner-temp?k=mp-e2e-run-20260928-44f03c", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "starter_trial" }),
    });
    const body = await r.json();
    console.log("MP_STARTER_TRIAL_E2E", JSON.stringify(body));
    expect(r.ok).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.default_provider).toBe("stripe");
    expect(body.cutover_ready).toBe(false);
    expect(body.stripe_subscription_id).toBe(null);
    expect(body.stripe_customer_id).toBe(null);
    expect(body.provider).toBe("mercado_pago");
    expect(body.trialDurationDays).toBe(4);
    expect(body.conversionPath).toBe("trial");
    expect(body.regularPrice).toBe(47);
    expect(String(body.seller_nickname || "")).toMatch(/^TESTUSER/);
    expect(String(body.url || "")).toContain("mercadopago");
  }, 30000);
});
