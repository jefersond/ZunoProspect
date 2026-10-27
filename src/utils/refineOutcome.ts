import { RefineClientError, createPublicErrorCode } from "@/lib/refineObservability";

export type RefineOutcomeKind = "generated" | "fallback" | "failed";

export interface RefineOutcome {
  kind: RefineOutcomeKind;
  model: string | null;
  reason: string | null;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Decide se a resposta de `analisar-lead-ia` é mesmo uma análise do Gemini.
 * O backend anterior respondia HTTP 200 com `used_fallback: true` quando o provedor falhava, e a tela
 * anunciava sucesso; esta função torna essa distinção explícita para qualquer tela que chame a função.
 */
export function classifyRefineResponse(data: unknown): RefineOutcome {
  const body = asRecord(data);
  if (!Object.keys(body).length) return { kind: "failed", model: null, reason: "empty_response" };

  const model = typeof body.model === "string" ? body.model : null;
  const debug = asRecord(body.debug);
  const reason = typeof body.fallback_reason === "string" ? body.fallback_reason : null;

  if (body.success === false) {
    return { kind: "failed", model, reason: typeof body.error_code === "string" ? body.error_code : "success_false" };
  }
  if (body.used_fallback === true || debug.fallback_used === true || model === "contextual-fallback") {
    return { kind: "fallback", model, reason: reason || "provider_fallback" };
  }
  return { kind: "generated", model, reason: null };
}

/** Erro apresentado quando a resposta não é uma análise válida do Gemini. Nenhum crédito é prometido nem cobrado. */
export function buildRefineOutcomeError(outcome: RefineOutcome, requestId: string): RefineClientError {
  const safeMessage = outcome.kind === "fallback"
    ? "A IA não conseguiu gerar uma análise agora e devolveu apenas um texto genérico de reserva. Ele não foi aplicado como análise concluída. Tente novamente em alguns instantes."
    : "Não foi possível concluir a análise com IA agora. Tente novamente em alguns instantes.";
  return new RefineClientError({
    success: false,
    request_id: requestId,
    public_error_code: createPublicErrorCode(requestId),
    category: "provider_error",
    safe_message: safeMessage,
    retryable: true,
    error_code: outcome.kind === "fallback" ? "REFINE_PROVIDER_FALLBACK_ONLY" : "REFINE_PROVIDER_INVALID_RESPONSE",
    error_message: safeMessage,
    credit_consumed: false,
  }, 200, false);
}

export type AnalysisOrigin = "gemini" | "fallback" | "not_generated" | "unknown";

/** Origem do que está salvo no lead, para mostrar "Gerado pelo Gemini", "Reserva" ou "Não gerado" sem inventar. */
export function getAnalysisOrigin(lead: { ai_analise_gerada_em?: string | null; ai_used_fallback?: boolean | null }): AnalysisOrigin {
  if (!lead.ai_analise_gerada_em) return "not_generated";
  if (lead.ai_used_fallback === true) return "fallback";
  if (lead.ai_used_fallback === false) return "gemini";
  return "unknown";
}
