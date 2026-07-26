export type ErrorCategory =
  | "validation_error" | "authentication_error" | "authorization_error"
  | "configuration_error" | "network_error" | "timeout_error" | "rate_limit_error"
  | "provider_error" | "database_error" | "edge_function_error"
  | "unexpected_response" | "unknown_error";

export interface AppErrorOptions {
  internalCode: string;
  category: ErrorCategory;
  stage: string;
  safeMessage: string;
  requestId: string;
  retryable?: boolean;
  httpStatus?: number;
  provider?: string;
  metadata?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly internalCode: string;
  readonly publicCode: string;
  readonly category: ErrorCategory;
  readonly stage: string;
  readonly safeMessage: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly provider?: string;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt = new Date().toISOString();

  constructor(options: AppErrorOptions) {
    super(options.safeMessage, { cause: options.cause });
    this.name = "AppError";
    this.internalCode = options.internalCode;
    this.publicCode = createPublicErrorCode(options.requestId);
    this.category = options.category;
    this.stage = options.stage;
    this.safeMessage = options.safeMessage;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? 500;
    this.provider = options.provider;
    this.metadata = options.metadata;
  }
}

const SECRET_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|service[-_]?role|signed[-_]?url)/i;
const EMAIL = /\b([A-Z0-9._%+-]{2,})@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SENSITIVE_QUERY = /([?&](?:token|key|signature|sig|secret|expires|x-amz-[^=]+)=)[^&#\s]+/gi;
const INLINE_SECRET = /\b(token|secret|password|api[-_]?key|signature)=([^&\s]+)/gi;

export const createRequestId = () => crypto.randomUUID();

export function createPublicErrorCode(requestId: string): string {
  return `ZUN-REF-${requestId.replace(/[^a-f0-9]/gi, "").slice(-6).toUpperCase().padStart(6, "0")}`;
}

export function sanitizeText(value: string, max = 500): string {
  const sanitized = value
    .replace(EMAIL, (_match, local: string, domain: string) => `${local.slice(0, 2)}***@${domain}`)
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(JWT, "[REDACTED_JWT]")
    .replace(INLINE_SECRET, "$1=[REDACTED]")
    .replace(SENSITIVE_QUERY, "$1[REDACTED]");
  return sanitized.length > max ? `${sanitized.slice(0, max)}…[truncated]` : sanitized;
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[MAX_DEPTH]";
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (value instanceof Error) return { name: sanitizeText(value.name, 80), message: sanitizeText(value.message) };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[REDACTED]" : sanitize(item, depth + 1),
    ]));
  }
  return sanitizeText(String(value));
}

export function structuredLog(
  level: "debug" | "info" | "warn" | "error",
  event: Record<string, unknown>,
): void {
  const payload = JSON.stringify(sanitize({
    timestamp: new Date().toISOString(),
    level,
    module: "analisar-lead-ia",
    feature: "refine-with-ai",
    operation: "analisar-lead-ia",
    ...event,
  }));
  (level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error)(payload);
}

export function toSafeErrorResponse(error: AppError) {
  const retryAfter = error.metadata?.retry_after_seconds;
  return {
    success: false as const,
    request_id: error.requestId,
    public_error_code: error.publicCode,
    category: error.category,
    safe_message: error.safeMessage,
    retryable: error.retryable,
    error_code: error.internalCode,
    error_message: error.safeMessage,
    ...(error.category === "rate_limit_error" ? { credit_consumed: false } : {}),
    ...(typeof retryAfter === "number" ? { retry_after_seconds: retryAfter } : {}),
  };
}

export function normalizeAppError(
  error: unknown,
  requestId: string,
  stage: string,
): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || (error instanceof Error && error.name === "AbortError")) {
    return new AppError({
      internalCode: "REFINE_PROVIDER_TIMEOUT",
      category: "timeout_error",
      stage,
      safeMessage: "O provedor de IA demorou para responder. Tente novamente em instantes.",
      requestId,
      retryable: true,
      httpStatus: 504,
      provider: "gemini",
      cause: error,
    });
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return new AppError({
      internalCode: "REFINE_PROVIDER_RATE_LIMITED",
      category: "rate_limit_error",
      stage,
      safeMessage: "O serviço de IA está temporariamente ocupado. Tente novamente em instantes.",
      requestId,
      retryable: true,
      httpStatus: 429,
      provider: "gemini",
      cause: error,
    });
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("api key")) {
    return new AppError({
      internalCode: "REFINE_PROVIDER_AUTH_FAILED",
      category: "configuration_error",
      stage,
      safeMessage: "O provedor de IA recusou a configura\u00e7\u00e3o do servi\u00e7o.",
      requestId,
      retryable: false,
      httpStatus: 503,
      provider: "gemini",
      cause: error,
    });
  }
  if (lower.includes("404") || lower.includes("modelo") && lower.includes("indispon")) {
    return new AppError({
      internalCode: "REFINE_PROVIDER_UNAVAILABLE",
      category: "provider_error",
      stage,
      safeMessage: "Os modelos de IA est?o temporariamente indispon?veis. Tente novamente em instantes.",
      requestId,
      retryable: true,
      httpStatus: 503,
      provider: "gemini",
      cause: error,
    });
  }
  if (lower.includes("resposta inválida") || lower.includes("não retornou análise") || lower.includes("plano deve")) {
    return new AppError({
      internalCode: "REFINE_PROVIDER_INVALID_RESPONSE",
      category: "unexpected_response",
      stage,
      safeMessage: "A IA não retornou uma análise válida. Tente novamente.",
      requestId,
      retryable: false,
      httpStatus: 502,
      provider: "gemini",
      cause: error,
    });
  }
  return new AppError({
    internalCode: "REFINE_UNKNOWN_ERROR",
    category: "unknown_error",
    stage,
    safeMessage: "Não foi possível refinar o conteúdo neste momento. Tente novamente.",
    requestId,
    retryable: false,
    httpStatus: 500,
    cause: error,
  });
}
