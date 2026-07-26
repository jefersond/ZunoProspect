import { supabase } from "@/integrations/supabase/client";
import {
  RefineClientError,
  buildRefineRequestBody,
  shouldRetryRefineError,
  createRefineRequestId,
  logRefineEvent,
  normalizeRefineError,
} from "@/lib/refineObservability";

const CLIENT_TIMEOUT_MS = 110_000;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));


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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      logRefineEvent("info", {
        request_id: requestId,
        operation: "analisar-lead-ia",
        stage: "call_edge_function",
        attempt,
      });
      const data = await invokeOnce<T>(body, accessToken, requestId);
      logRefineEvent("info", {
        request_id: requestId,
        operation: "analisar-lead-ia",
        stage: "render_result",
        attempt,
        duration_ms: Math.round(performance.now() - startedAt),
      });
      return { data, requestId };
    } catch (error) {
      const normalized = await normalizeRefineError(error, requestId);
      logRefineEvent(attempt === 1 && normalized.payload.retryable ? "warn" : "error", {
        request_id: requestId,
        public_error_code: normalized.payload.public_error_code,
        operation: "analisar-lead-ia",
        stage: "call_edge_function",
        category: normalized.payload.category,
        internal_code: normalized.payload.error_code,
        retryable: normalized.payload.retryable,
        attempt,
        duration_ms: Math.round(performance.now() - startedAt),
      });
      if (shouldRetryRefineError(normalized, attempt)) {
        await wait(450 + Math.floor(Math.random() * 350));
        continue;
      }
      throw normalized;
    }
  }
  throw new RefineClientError({
    success: false,
    request_id: requestId,
    public_error_code: `ZUN-REF-${requestId.replace(/-/g, "").slice(-6).toUpperCase()}`,
    category: "unknown_error",
    safe_message: "Não foi possível concluir o refinamento.",
    retryable: false,
    error_code: "REFINE_UNKNOWN_ERROR",
  });
}
