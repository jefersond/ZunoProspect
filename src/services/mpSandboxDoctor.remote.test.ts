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
  }, 20000);
});
