import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { refineWithAI, resetRefineRequestGateForTests } from "./refineWithAI";
import {
  configureSellerProfileStorage,
  loadSellerProfileForUser,
  resetSellerProfileStateForTests,
  saveSellerProfile,
} from "@/lib/sellerProfile";

const completeProfile = {
  display_name: "Marina Costa",
  company_name: "Costa Digital",
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "",
};

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
  beforeEach(async () => {
    resetRefineRequestGateForTests();
    invokeMock.mockReset();
    resetSellerProfileStateForTests();
    const memory = new Map<string, unknown>();
    configureSellerProfileStorage({
      load: async (userId) => (memory.get(userId) as never) ?? null,
      save: async (userId, profile) => { memory.set(userId, profile); },
    });
    await loadSellerProfileForUser("user-1");
    await saveSellerProfile(completeProfile);
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

  it("coalesces concurrent requests for the same lead", async () => {
    let release: ((value: { data: { success: boolean }; error: null }) => void) | undefined;
    invokeMock.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    const first = refineWithAI({ leadId: "lead-1" }, "test-token", requestId);
    const second = refineWithAI({ leadId: "lead-1" }, "test-token", "second-request-id");
    expect(invokeMock).toHaveBeenCalledTimes(1);

    release?.({ data: { success: true }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { data: { success: true }, requestId },
      { data: { success: true }, requestId },
    ]);
  });

  it("blocks another network call for the same lead during rate-limit cooldown", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: structuredError(429, "REFINE_PROVIDER_RATE_LIMITED", true),
    });
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId)).rejects.toBeInstanceOf(Error);
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", "second-request-id")).rejects.toMatchObject({
      status: 429,
      payload: { category: "rate_limit_error" },
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

  it("aborts a stalled request on client timeout instead of leaving it running unattended", async () => {
    vi.useFakeTimers();
    try {
      invokeMock.mockImplementation(
        (_name: string, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => {
              const abortError = new Error("The operation was aborted.");
              abortError.name = "AbortError";
              reject(abortError);
            });
          }),
      );
      const resultPromise = refineWithAI({ leadId: "lead-1" }, "test-token", requestId);
      const assertion = expect(resultPromise).rejects.toMatchObject({
        payload: { category: "timeout_error" },
      });
      await vi.advanceTimersByTimeAsync(70_000);
      await assertion;
      expect(invokeMock).toHaveBeenCalledTimes(1);
      const [, options] = invokeMock.mock.calls[0] as [string, { signal?: AbortSignal }];
      expect(options.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("envia o perfil comercial do assinante junto com o lead (uma única chamada)", async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    await refineWithAI({ leadId: "lead-1" }, "test-token", requestId);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    const sent = invokeMock.mock.calls[0][1].body;
    expect(sent.seller_profile).toMatchObject({ display_name: "Marina Costa", service_offered: "Criação de sites para negócios locais" });
  });

  it("sem perfil comercial completo NÃO chama a função (sem rede, sem crédito)", async () => {
    resetSellerProfileStateForTests();
    await expect(refineWithAI({ leadId: "lead-1" }, "test-token", requestId)).rejects.toMatchObject({
      payload: { error_code: "REFINE_PROFILE_REQUIRED", retryable: false, credit_consumed: false },
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
