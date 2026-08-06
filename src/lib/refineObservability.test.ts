import { describe, expect, it } from "vitest";
import {
  buildInternalProblemReport,
  buildRefineRequestBody,
  buildSafeProblemReport,
  classifyRefineError,
  createPublicErrorCode,
  createRefineRequestId,
  formatRefineConsoleMessage,
  getRefineDisplayMessage,
  maskEmail,
  normalizeRefineError,
  sanitizeForTelemetry,
  sanitizeText,
  shouldRetryRefineError,
} from "./refineObservability";
import { RefineClientError } from "./refineObservability";

describe("refine observability", () => {
  it("creates a UUID request id and a stable non-sequential public code", () => {
    const requestId = createRefineRequestId();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(createPublicErrorCode(requestId)).toMatch(/^ZUN-REF-[A-F0-9]{6}$/);
    expect(createPublicErrorCode(requestId)).toBe(createPublicErrorCode(requestId));
  });

  it.each([
    [400, "invalid payload", "validation_error", "REFINE_INPUT_INVALID", false],
    [401, "session missing", "authentication_error", "REFINE_SESSION_MISSING", false],
    [403, "permission denied", "authorization_error", "REFINE_PERMISSION_DENIED", false],
    [429, "rate limit", "rate_limit_error", "REFINE_PROVIDER_RATE_LIMITED", true],
    [504, "timeout", "timeout_error", "REFINE_PROVIDER_TIMEOUT", true],
    [503, "unavailable", "edge_function_error", "REFINE_FUNCTION_UNAVAILABLE", true],
  ] as const)("maps HTTP %s to a stable classification", (status, message, category, code, retryable) => {
    expect(classifyRefineError(status, message)).toEqual({ category, internalCode: code, retryable });
  });

  it("does not mark permanent validation and authorization failures for retry", () => {
    expect(classifyRefineError(400, "invalid").retryable).toBe(false);
    expect(classifyRefineError(403, "permission").retryable).toBe(false);
    expect(classifyRefineError(429, "rate limit").retryable).toBe(true);
  });

  it("sanitizes tokens, emails, headers and signed URLs", () => {
    const sanitized = sanitizeForTelemetry({
      Authorization: "Bearer secret-token",
      cookie: "session=abc",
      nested: {
        email: "joao.silva@example.com",
        note: "Bearer abc.def.ghi https://example.com/a?signature=secret&ok=1",
      },
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("session=abc");
    expect(serialized).not.toContain("joao.silva@example.com");
    expect(serialized).not.toContain("signature=secret");
    expect(serialized).toContain("[REDACTED]");
    expect(maskEmail("joao.silva@example.com")).toBe("jo***@example.com");
  });

  it("limits text, collection size and metadata depth", () => {
    const sanitized = sanitizeForTelemetry({
      long: "x".repeat(5_000),
      list: Array.from({ length: 100 }, (_, index) => index),
      deep: { a: { b: { c: { d: { e: "hidden" } } } } },
    }) as Record<string, unknown>;
    expect(String(sanitized.long).length).toBeLessThan(550);
    expect(sanitized.list).toHaveLength(20);
    expect(JSON.stringify(sanitized)).toContain("[MAX_DEPTH]");
  });

  it("normalizes a safe backend response without exposing technical details", async () => {
    const requestId = createRefineRequestId();
    const response = new Response(JSON.stringify({
      success: false,
      request_id: requestId,
      public_error_code: createPublicErrorCode(requestId),
      category: "rate_limit_error",
      safe_message: "Serviço temporariamente ocupado.",
      retryable: true,
      error_code: "REFINE_PROVIDER_RATE_LIMITED",
    }), { status: 429 });
    const normalized = await normalizeRefineError({ message: "raw internal", context: response }, requestId);
    expect(normalized.payload).toMatchObject({
      success: false,
      request_id: requestId,
      category: "rate_limit_error",
      retryable: true,
    });
    expect(JSON.stringify(normalized.payload)).not.toContain("raw internal");
  });

  it("keeps the original input immutable and allows at most one transient retry", () => {
    const original = { lead: { name: "Empresa" } };
    const body = buildRefineRequestBody(original, "request-1");
    expect(original).toEqual({ lead: { name: "Empresa" } });
    expect(body).toEqual({ lead: { name: "Empresa" }, request_id: "request-1" });
    const transient = new RefineClientError({
      success: false, request_id: "request-1", public_error_code: "ZUN-REF-000001",
      category: "network_error", safe_message: "Falha", retryable: true,
    });
    const permanent = new RefineClientError({ ...transient.payload, retryable: false });
    expect(shouldRetryRefineError(transient, 1)).toBe(true);
    expect(shouldRetryRefineError(transient, 2)).toBe(false);
    expect(shouldRetryRefineError(permanent, 1)).toBe(false);
  });

  it("keeps technical identifiers internal while the visible report stays safe", () => {
    const requestId = createRefineRequestId();
    const error = {
      success: false,
      request_id: requestId,
      public_error_code: createPublicErrorCode(requestId),
      category: "unknown_error",
      safe_message: "Falha segura",
      retryable: false,
      error_code: "REFINE_UNKNOWN_ERROR",
    } as const;
    const report = buildSafeProblemReport(error, "Meu contato é pessoa@example.com e token Bearer abc123");
    const internal = buildInternalProblemReport(
      error,
      "Meu contato é pessoa@example.com e token Bearer abc123",
      new Date("2026-07-26T10:00:00.000Z"),
      "6fa7943",
    );
    expect(report).not.toContain(error.public_error_code);
    expect(report).not.toContain(requestId);
    expect(report).toContain("pe***@example.com");
    expect(report).not.toContain("Bearer abc123");
    expect(internal).toMatchObject({
      correlation_id: error.public_error_code,
      request_id: requestId,
      safe_code: "REFINE_UNKNOWN_ERROR",
      occurred_at: "2026-07-26T10:00:00.000Z",
      operation: "analisar-lead-ia",
      app_version: "6fa7943",
    });
    expect(sanitizeText("x".repeat(1000), 20)).toContain("truncated");
  });

  it("does not print the technical event object in the production console", () => {
    const message = formatRefineConsoleMessage("error", {
      request_id: "private-request",
      internal_code: "REFINE_PROVIDER_RATE_LIMITED",
      raw_event: { provider: "gemini" },
    }, true);
    expect(message).toBe("Refinamento indisponível temporariamente.");
    expect(message).not.toContain("private-request");
    expect(message).not.toContain("gemini");
  });

  it("removes the correlation id from the public message", () => {
    const error = {
      success: false,
      request_id: "request-private",
      public_error_code: "ZUN-REF-CC25D1",
      category: "rate_limit_error",
      safe_message: "Serviço ocupado. Informe ZUN-REF-CC25D1 ao suporte.",
      retryable: true,
      error_code: "REFINE_PROVIDER_RATE_LIMITED",
    } as const;
    expect(getRefineDisplayMessage(error)).toBe("Serviço ocupado. Informe ao suporte.");
  });
});
