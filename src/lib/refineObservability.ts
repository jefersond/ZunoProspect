export const REFINE_FEATURE = "refine-with-ai";

export type RefineStage =
  | "validate_input"
  | "load_session"
  | "prepare_request"
  | "call_edge_function"
  | "validate_backend_input"
  | "authorize_user"
  | "load_configuration"
  | "call_ai_provider"
  | "validate_ai_response"
  | "persist_result"
  | "return_response"
  | "render_result";

export type RefineErrorCategory =
  | "validation_error"
  | "authentication_error"
  | "authorization_error"
  | "configuration_error"
  | "network_error"
  | "timeout_error"
  | "rate_limit_error"
  | "provider_error"
  | "database_error"
  | "edge_function_error"
  | "unexpected_response"
  | "unknown_error";

export type RefineInternalCode =
  | "REFINE_INPUT_INVALID"
  | "REFINE_SESSION_MISSING"
  | "REFINE_PERMISSION_DENIED"
  | "REFINE_FUNCTION_UNAVAILABLE"
  | "REFINE_PROVIDER_TIMEOUT"
  | "REFINE_PROVIDER_RATE_LIMITED"
  | "REFINE_PROVIDER_REJECTED"
  | "REFINE_PROVIDER_INVALID_RESPONSE"
  | "REFINE_SAVE_FAILED"
  | "REFINE_UNKNOWN_ERROR";

export interface RefineErrorPayload {
  success: false;
  request_id: string;
  public_error_code: string;
  category: RefineErrorCategory;
  safe_message: string;
  retryable: boolean;
  error_code?: RefineInternalCode | string;
  error_message?: string;
}

export interface RefineSuccessResponse<T> {
  success: true;
  request_id: string;
  data: T;
  timing?: { total_ms?: number; provider_ms?: number; persistence_ms?: number };
}

const SECRET_KEY_PATTERN = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|service[-_]?role|refresh[-_]?token|access[-_]?token|signed[-_]?url)/i;
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|key|signature|sig|secret|expires|x-amz-[^=]+)=)[^&#\s]+/gi;
const EMAIL_PATTERN = /\b([A-Z0-9._%+-]{2,})@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const API_KEY_PATTERN = /\bAIza[A-Za-z0-9_-]{20,}\b/g;
const INLINE_SECRET_PATTERN = /\b(token|secret|password|api[-_]?key|signature)=([^&\s]+)/gi;

const limitText = (value: string, max = 500): string =>
  value.length > max ? `${value.slice(0, max)}…[truncated]` : value;

export function createRefineRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createPublicErrorCode(requestId: string): string {
  const suffix = requestId.replace(/[^a-f0-9]/gi, "").slice(-6).toUpperCase().padStart(6, "0");
  return `ZUN-REF-${suffix}`;
}

export function maskEmail(value: string): string {
  return value.replace(EMAIL_PATTERN, (_match, local: string, domain: string) =>
    `${local.slice(0, 2)}***@${domain}`,
  );
}

export function sanitizeText(value: string, max = 500): string {
  return limitText(
    maskEmail(value)
      .replace(BEARER_PATTERN, "Bearer [REDACTED]")
      .replace(JWT_PATTERN, "[REDACTED_JWT]")
      .replace(API_KEY_PATTERN, "[REDACTED_API_KEY]")
      .replace(INLINE_SECRET_PATTERN, "$1=[REDACTED]")
      .replace(SENSITIVE_QUERY_PATTERN, "$1[REDACTED]"),
    max,
  );
}

export function sanitizeForTelemetry(
  value: unknown,
  options: { depth?: number; maxKeys?: number; maxText?: number } = {},
): unknown {
  const depth = options.depth ?? 0;
  const maxKeys = options.maxKeys ?? 30;
  const maxText = options.maxText ?? 500;
  if (depth > 4) return "[MAX_DEPTH]";
  if (typeof value === "string") return sanitizeText(value, maxText);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (value instanceof Error) {
    return { name: sanitizeText(value.name, 80), message: sanitizeText(value.message, maxText) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) =>
      sanitizeForTelemetry(item, { depth: depth + 1, maxKeys, maxText }),
    );
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, maxKeys)
        .map(([key, item]) => [
          key,
          SECRET_KEY_PATTERN.test(key)
            ? "[REDACTED]"
            : sanitizeForTelemetry(item, { depth: depth + 1, maxKeys, maxText }),
        ]),
    );
  }
  return sanitizeText(String(value), maxText);
}

const isCategory = (value: unknown): value is RefineErrorCategory =>
  typeof value === "string" &&
  [
    "validation_error", "authentication_error", "authorization_error", "configuration_error",
    "network_error", "timeout_error", "rate_limit_error", "provider_error", "database_error",
    "edge_function_error", "unexpected_response", "unknown_error",
  ].includes(value);

export function classifyRefineError(status?: number, message = "", code = ""): {
  category: RefineErrorCategory;
  internalCode: RefineInternalCode;
  retryable: boolean;
} {
  const haystack = `${message} ${code}`.toLowerCase();
  if (status === 400 || haystack.includes("payload") || haystack.includes("invalid")) {
    return { category: "validation_error", internalCode: "REFINE_INPUT_INVALID", retryable: false };
  }
  if (status === 401 || haystack.includes("session") || haystack.includes("autentic")) {
    return { category: "authentication_error", internalCode: "REFINE_SESSION_MISSING", retryable: false };
  }
  if (status === 429 || haystack.includes("rate limit")) {
    return { category: "rate_limit_error", internalCode: "REFINE_PROVIDER_RATE_LIMITED", retryable: true };
  }
  if (status === 402 || status === 403 || haystack.includes("permission") || haystack.includes("limit")) {
    return { category: "authorization_error", internalCode: "REFINE_PERMISSION_DENIED", retryable: false };
  }
  if (status === 408 || status === 504 || haystack.includes("timeout") || haystack.includes("abort")) {
    return { category: "timeout_error", internalCode: "REFINE_PROVIDER_TIMEOUT", retryable: true };
  }
  if (status === 422 || haystack.includes("resposta inválida") || haystack.includes("invalid response")) {
    return { category: "unexpected_response", internalCode: "REFINE_PROVIDER_INVALID_RESPONSE", retryable: false };
  }
  if (status && status >= 500) {
    return { category: "edge_function_error", internalCode: "REFINE_FUNCTION_UNAVAILABLE", retryable: true };
  }
  if (haystack.includes("fetch") || haystack.includes("network") || haystack.includes("failed to send")) {
    return { category: "network_error", internalCode: "REFINE_FUNCTION_UNAVAILABLE", retryable: true };
  }
  return { category: "unknown_error", internalCode: "REFINE_UNKNOWN_ERROR", retryable: false };
}

export const buildRefineRequestBody = (body: Record<string, unknown>, requestId: string) => ({
  ...body,
  request_id: requestId,
});
export class RefineClientError extends Error {
  readonly payload: RefineErrorPayload;
  readonly status?: number;
  readonly retryConfirmedByBackend: boolean;

  constructor(
    payload: RefineErrorPayload,
    status?: number,
    retryConfirmedByBackend = true,
  ) {
    super(payload.safe_message);
    this.name = "RefineClientError";
    this.payload = payload;
    this.status = status;
    this.retryConfirmedByBackend = retryConfirmedByBackend;
  }
}

export const shouldRetryRefineError = (error: RefineClientError, attempt: number) =>
  attempt === 1 && error.payload.retryable && error.retryConfirmedByBackend;

type FunctionErrorLike = {
  message?: string;
  context?: Response | { status?: number };
};

export async function normalizeRefineError(error: unknown, fallbackRequestId: string): Promise<RefineClientError> {
  if (error instanceof RefineClientError) return error;
  const candidate = error as FunctionErrorLike | null;
  const status = candidate?.context instanceof Response
    ? candidate.context.status
    : candidate?.context?.status;
  let parsed: Partial<RefineErrorPayload> = {};
  if (candidate?.context instanceof Response) {
    try {
      parsed = await candidate.context.clone().json();
    } catch {
      // A resposta pode não conter JSON; a classificação ainda usa status e mensagem.
    }
  }
  const retryConfirmedByBackend =
    parsed.success === false &&
    typeof parsed.request_id === "string" &&
    typeof parsed.retryable === "boolean" &&
    typeof parsed.error_code === "string";
  const requestId = typeof parsed.request_id === "string" ? parsed.request_id : fallbackRequestId;
  const rawMessage = typeof parsed.safe_message === "string"
    ? parsed.safe_message
    : typeof candidate?.message === "string" ? candidate.message : "Falha inesperada";
  const rawCode = typeof parsed.error_code === "string" ? parsed.error_code : "";
  const classified = classifyRefineError(status, rawMessage, rawCode);
  const category = isCategory(parsed.category) ? parsed.category : classified.category;
  const publicCode = typeof parsed.public_error_code === "string"
    ? parsed.public_error_code
    : createPublicErrorCode(requestId);
  const safeMessage = typeof parsed.safe_message === "string"
    ? sanitizeText(parsed.safe_message, 240)
    : `Não foi possível refinar o conteúdo neste momento. Tente novamente. Se o problema continuar, informe o código ${publicCode} ao suporte.`;
  return new RefineClientError({
    success: false,
    request_id: requestId,
    public_error_code: publicCode,
    category,
    safe_message: safeMessage,
    retryable: typeof parsed.retryable === "boolean" ? parsed.retryable : classified.retryable,
    error_code: rawCode || classified.internalCode,
    error_message: safeMessage,
  }, status, retryConfirmedByBackend);
}

export function logRefineEvent(
  level: "debug" | "info" | "warn" | "error",
  event: Record<string, unknown>,
): void {
  const payload = sanitizeForTelemetry({
    timestamp: new Date().toISOString(),
    level,
    module: "refineWithAI",
    feature: REFINE_FEATURE,
    ...event,
  });
  const method = level === "debug" ? "debug" : level;
  console[method](JSON.stringify(payload));
}

export function buildSafeProblemReport(
  error: RefineErrorPayload,
  description: string,
  occurredAt = new Date(),
): string {
  return [
    "Relato de problema — Refinar com IA",
    `Código: ${error.public_error_code}`,
    `Data/hora: ${occurredAt.toISOString()}`,
    `Funcionalidade: ${REFINE_FEATURE}`,
    `Descrição: ${sanitizeText(description.trim() || "Não informada", 300)}`,
  ].join("\n");
}
