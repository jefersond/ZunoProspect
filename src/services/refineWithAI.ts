import { supabase } from "@/integrations/supabase/client";
import {
  buildRefineRequestBody,
  createRefineRequestId,
  logRefineEvent,
  normalizeRefineError,
} from "@/lib/refineObservability";

const CLIENT_TIMEOUT_MS = 110_000;


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

export async function refineWithAI<T>(
  body: Record<string, unknown>,
  accessToken: string,
  requestId = createRefineRequestId(),
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
