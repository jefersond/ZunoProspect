import { AppError, toSafeErrorResponse, type ErrorCategory } from "./refine-observability.ts";

const CATEGORY_BY_CODE: Record<string, { category: ErrorCategory; retryable: boolean }> = {
  REFINE_CONFIGURATION_MISSING: { category: "configuration_error", retryable: true },
  REFINE_SESSION_MISSING: { category: "authentication_error", retryable: false },
  REFINE_SESSION_INVALID: { category: "authentication_error", retryable: false },
  REFINE_INPUT_INVALID: { category: "validation_error", retryable: false },
  REFINE_LEAD_REFERENCE_INVALID: { category: "validation_error", retryable: false },
  REFINE_LEAD_NOT_FOUND: { category: "validation_error", retryable: false },
  REFINE_PROFILE_REQUIRED: { category: "validation_error", retryable: false },
  REFINE_PLAN_EXISTS: { category: "validation_error", retryable: false },
  REFINE_LEAD_OPTED_OUT: { category: "validation_error", retryable: false },
  REFINE_PERMISSION_DENIED: { category: "authorization_error", retryable: false },
  REFINE_PROVIDER_INVALID_REQUEST: { category: "configuration_error", retryable: false },
  REFINE_PROVIDER_AUTH_FAILED: { category: "configuration_error", retryable: false },
  REFINE_PROVIDER_INVALID_RESPONSE: { category: "unexpected_response", retryable: true },
  REFINE_PROVIDER_UNAVAILABLE: { category: "provider_error", retryable: true },
  REFINE_SAVE_FAILED: { category: "database_error", retryable: true },
  REFINE_UNKNOWN_ERROR: { category: "unknown_error", retryable: true },
};

/**
 * Corpo de erro no formato seguro que o cliente (antigo e novo) já entende: safe_message, retryable, category.
 * `credit_consumed` fala do crédito INTERNO do assinante; não diz nada sobre a cobrança do provedor de IA.
 */
export function buildRefineFailure(requestId: string, code: string, status: number, message: string, extra: Record<string, unknown> = {}) {
  const meta = CATEGORY_BY_CODE[code] ?? { category: "unknown_error" as ErrorCategory, retryable: false };
  const error = new AppError({ internalCode: code, category: meta.category, stage: "analyze", safeMessage: message, requestId, retryable: meta.retryable, httpStatus: status });
  return { status, body: { ...toSafeErrorResponse(error), credit_consumed: false, ...extra } };
}
