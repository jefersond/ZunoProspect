import { describe, expect, it } from "vitest";
import { normalizeAppError, toSafeErrorResponse } from "./refine-observability.ts";

const requestId = "8fd50939-bbef-4dc6-a337-aa8168cc25d1";

describe("refine provider error mapping", () => {
  it.each([
    ["Gemini API error: 429", "REFINE_PROVIDER_RATE_LIMITED", "rate_limit_error", 429, true],
    ["Timeout: modelo demorou", "REFINE_PROVIDER_TIMEOUT", "timeout_error", 504, true],
    ["Todos os modelos falharam. ?ltimo erro: Modelo indispon?vel (404)", "REFINE_PROVIDER_UNAVAILABLE", "provider_error", 503, true],
    ["Gemini API error: 401", "REFINE_PROVIDER_AUTH_FAILED", "configuration_error", 503, false],
    ["Gemini API error: 403", "REFINE_PROVIDER_AUTH_FAILED", "configuration_error", 503, false],
    ["plano deve ter pelo menos 5 dias", "REFINE_PROVIDER_INVALID_RESPONSE", "unexpected_response", 502, false],
  ] as const)("maps %s to a safe technical code", (message, code, category, status, retryable) => {
    const error = normalizeAppError(new Error(message), requestId, "call_ai_provider");
    expect(error).toMatchObject({ internalCode: code, category, httpStatus: status, retryable });
    const response = JSON.stringify(toSafeErrorResponse(error));
    expect(response).not.toContain(message);
    expect(response).not.toContain("stack");
  });

  it("keeps unknown failures non-retryable and sanitized", () => {
    const error = normalizeAppError(new Error("token=private unexpected"), requestId, "call_ai_provider");
    expect(error).toMatchObject({ internalCode: "REFINE_UNKNOWN_ERROR", retryable: false });
    expect(JSON.stringify(toSafeErrorResponse(error))).not.toContain("private");
  });
});
