import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { refineWithAI } from "./refineWithAI";

const requestId = "8fd50939-bbef-4dc6-a337-aa8168cc25d1";

const structuredError = (status: number, errorCode: string, retryable: boolean) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify({
    success: false,
    request_id: requestId,
    public_error_code: "ZUN-REF-25D1",
    category: status === 429 ? "rate_limit_error" : "provider_error",
    safe_message: "Falha segura",
    retryable,
    error_code: errorCode,
  }), { status }),
});

describe("refineWithAI retry policy", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns success from the first call without duplication", async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId))
      .resolves.toMatchObject({ data: { success: true }, requestId });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("does not repeat the whole Edge Function for a transient 429", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: structuredError(429, "REFINE_PROVIDER_RATE_LIMITED", true),
    });
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId)).rejects.toMatchObject({
      payload: { retryable: true, error_code: "REFINE_PROVIDER_RATE_LIMITED" },
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an ambiguous network error that could hide a completed request", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId)).rejects.toMatchObject({
      retryConfirmedByBackend: false,
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a permanent provider response", async () => {
    invokeMock.mockResolvedValue({ data: null, error: structuredError(503, "REFINE_PROVIDER_AUTH_FAILED", false) });
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId)).rejects.toMatchObject({
      payload: { retryable: false, error_code: "REFINE_PROVIDER_AUTH_FAILED" },
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
