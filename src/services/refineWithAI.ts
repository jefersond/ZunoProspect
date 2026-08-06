import { supabase } from "@/integrations/supabase/client";
import {
  RefineClientError,
  buildRefineRequestBody,
  createRefineRequestId,
  logRefineEvent,
  normalizeRefineError,
  type RefineErrorPayload,
} from "@/lib/refineObservability";

// O backend orça no máximo ~45s para o provedor de IA (REFINE_PROVIDER_TOTAL_BUDGET_MS) mais
// alguns segundos de scraping/persistência. 70s dá margem confortável sem deixar o usuário
// esperando o dobro do pior caso real do servidor.
const CLIENT_TIMEOUT_MS = 70_000;
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
  // Um AbortController real (em vez de Promise.race) garante que, ao estourar o timeout do
  // cliente, a requisição HTTP em andamento é efetivamente cancelada em vez de ficar
  // rodando sem supervisão em segundo plano no servidor.
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
