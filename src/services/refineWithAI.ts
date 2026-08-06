import { supabase } from "@/integrations/supabase/client";
import {
  RefineClientError,
  buildRefineRequestBody,
  shouldRetryRefineError,
  createRefineRequestId,
  logRefineEvent,
  normalizeRefineError,
} from "@/lib/refineObservability";

// O backend orça no máximo ~45s para o provedor de IA (REFINE_PROVIDER_TOTAL_BUDGET_MS) mais
// alguns segundos de scraping/persistência. 70s dá margem confortável sem deixar o usuário
// esperando o dobro do pior caso real do servidor.
const CLIENT_TIMEOUT_MS = 70_000;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));


async function invokeOnce<T>(
  body: Record<string, unknown>,
  accessToken: string,
  requestId: string,
): Promise<T> {
  // Um AbortController real (em vez de Promise.race) garante que, ao estourar o timeout do
  // cliente, a requisição HTTP em andamento é efetivamente cancelada — evitando que uma
  // segunda tentativa (retry) rode em paralelo com uma primeira chamada ainda ativa no
  // servidor, o que duplicaria a chamada de IA e o consumo de crédito para o mesmo clique.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const result = await supabase.functions.invoke("analisar-lead-ia", {
      body: buildRefineRequestBody(body, requestId),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-request-id": requestId,
      },
      signal: controller.signal,
    });
    if (result.error) throw result.error;
    return result.data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("REFINE_CLIENT_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
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
