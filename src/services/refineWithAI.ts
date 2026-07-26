import { supabase } from "@/integrations/supabase/client";
import {
  RefineClientError,
  buildRefineRequestBody,
  createRefineRequestId,
  logRefineEvent,
  normalizeRefineError,
  type RefineErrorPayload,
} from "@/lib/refineObservability";

const CLIENT_TIMEOUT_MS = 110_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 30;
const inFlightByLead = new Map<string, Promise<{ data: unknown; requestId: string }>>();
const cooldownByLead = new Map<string, { until: number; payload: RefineErrorPayload }>();

const getLogicalLeadKey = (body: Record<string, unknown>, requestId: string) =>
  String(body.leadId || body.lead_id || body.lead_key || requestId);

async function invokeOnce<T>(
  body: Record<string, unknown>,
  accessToken: string,
  requestId: string,
): Promise<T> {
  const invokePromise = supabase.functions.invoke("analisar-lead-ia", {
    body: buildRefineRequestBody(body, requestId),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-request-id": requestId,
    },
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error("REFINE_CLIENT_TIMEOUT")), CLIENT_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([invokePromise, timeoutPromise]);
    if (result.error) throw result.error;
    return result.data as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function executeRefine<T>(
  body: Record<string, unknown>,
  accessToken: string,
  requestId: string,
  logicalLeadKey: string,
): Promise<{ data: T; requestId: string }> {
  const startedAt = performance.now();
  try {
    logRefineEvent("info", {
      request_id: requestId,
      operation: "analisar-lead-ia",
      stage: "call_edge_function",
      attempt: 1,
    });
    const data = await invokeOnce<T>(body, accessToken, requestId);
    cooldownByLead.delete(logicalLeadKey);
    logRefineEvent("info", {
      request_id: requestId,
      operation: "analisar-lead-ia",
      stage: "render_result",
      attempt: 1,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    return { data, requestId };
  } catch (error) {
    const normalized = await normalizeRefineError(error, requestId);
    if (normalized.payload.category === "rate_limit_error") {
      const cooldownSeconds = Math.max(
        1,
        Math.min(60, Math.ceil(normalized.payload.retry_after_seconds || DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS)),
      );
      normalized.payload.retry_after_seconds = cooldownSeconds;
      cooldownByLead.set(logicalLeadKey, {
        until: Date.now() + cooldownSeconds * 1_000,
        payload: normalized.payload,
      });
    }
    logRefineEvent(normalized.payload.retryable ? "warn" : "error", {
      request_id: requestId,
      public_error_code: normalized.payload.public_error_code,
      operation: "analisar-lead-ia",
      stage: "call_edge_function",
      category: normalized.payload.category,
      internal_code: normalized.payload.error_code,
      retryable: normalized.payload.retryable,
      attempt: 1,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw normalized;
  }
}

export async function refineWithAI<T>(
  body: Record<string, unknown>,
  accessToken: string,
  requestId = createRefineRequestId(),
): Promise<{ data: T; requestId: string }> {
  const logicalLeadKey = getLogicalLeadKey(body, requestId);
  const cooldown = cooldownByLead.get(logicalLeadKey);
  if (cooldown) {
    const remainingSeconds = Math.ceil((cooldown.until - Date.now()) / 1_000);
    if (remainingSeconds > 0) {
      throw new RefineClientError({
        ...cooldown.payload,
        retry_after_seconds: remainingSeconds,
      }, 429, true);
    }
    cooldownByLead.delete(logicalLeadKey);
  }

  const existing = inFlightByLead.get(logicalLeadKey);
  if (existing) return existing as Promise<{ data: T; requestId: string }>;

  const operation = executeRefine<T>(body, accessToken, requestId, logicalLeadKey);
  inFlightByLead.set(logicalLeadKey, operation as Promise<{ data: unknown; requestId: string }>);
  try {
    return await operation;
  } finally {
    if (inFlightByLead.get(logicalLeadKey) === operation) {
      inFlightByLead.delete(logicalLeadKey);
    }
  }
}

export function resetRefineRequestGateForTests(): void {
  inFlightByLead.clear();
  cooldownByLead.clear();
}
