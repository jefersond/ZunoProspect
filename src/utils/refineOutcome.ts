import { RefineClientError, createPublicErrorCode } from "@/lib/refineObservability";

export type RefineOutcomeKind = "generated" | "fallback" | "failed";

export interface RefineOutcome {
  kind: RefineOutcomeKind;
  model: string | null;
  reason: string | null;
  /** O backend reconheceu uma análise recém-gravada e não gerou outra (clique duplo, duas abas). */
  alreadyCurrent?: boolean;
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
  return { kind: "generated", model, reason: null, alreadyCurrent: body.already_current === true };
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

/**
 * `ai_used_fallback` vem da coluna quando a leitura a devolve; as funções de leitura do banco hoje não a incluem,
 * então, depois de recarregar a página, a origem é recuperada do próprio plano salvo (`model` e `debug.fallback_used`,
 * gravados junto com cada análise). Sem nenhum dos dois (análise antiga), devolve undefined: a tela não afirma nada.
 */
export function resolveUsedFallback(row: { ai_used_fallback?: unknown; plano_prospeccao?: unknown } | null | undefined): boolean | undefined {
  if (!row) return undefined;
  if (typeof row.ai_used_fallback === "boolean") return row.ai_used_fallback;
  const plan = asRecord(row.plano_prospeccao);
  const debug = asRecord(plan.debug);
  if (plan.model === "contextual-fallback" || debug.fallback_used === true) return true;
  if (typeof plan.model === "string" && plan.model.startsWith("gemini")) return false;
  return undefined;
}

/** "27/10/2026 às 11:48", no fuso do navegador; texto vazio se a data for inválida. */
export function formatRefinedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("pt-BR");
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

export type PersistenceCheck = { ok: true; usedFallback: boolean | undefined } | { ok: false; reason: string };

/**
 * Comprova, a partir do registro lido de novo no banco, que a análise anunciada foi mesmo gravada: tem data,
 * é diferente da anterior (salvo duplicata reconhecida pelo backend), traz diagnóstico e os 7 dias com mensagem.
 * Nunca usa a resposta da função nem a hora local como prova.
 */
export function confirmPersistedRefine(
  row: ({ ai_analise_gerada_em?: unknown; diagnostico_bullets?: unknown; plano_prospeccao?: unknown; ai_used_fallback?: unknown }) | null | undefined,
  previousGeneratedAt: string | null | undefined,
  opts: { alreadyCurrent?: boolean } = {},
): PersistenceCheck {
  if (!row) return { ok: false, reason: "read_failed" };
  const savedAt = typeof row.ai_analise_gerada_em === "string" ? Date.parse(row.ai_analise_gerada_em) : NaN;
  if (!Number.isFinite(savedAt)) return { ok: false, reason: "no_timestamp" };
  const previous = previousGeneratedAt ? Date.parse(previousGeneratedAt) : NaN;
  if (!opts.alreadyCurrent && Number.isFinite(previous) && savedAt === previous) return { ok: false, reason: "not_updated" };

  const bullets = Array.isArray(row.diagnostico_bullets)
    ? row.diagnostico_bullets.filter((b) => typeof b === "string" && b.trim())
    : [];
  if (bullets.length < 3) return { ok: false, reason: "diagnostico_incomplete" };

  const rawPlan = Array.isArray(row.plano_prospeccao) ? row.plano_prospeccao : asRecord(row.plano_prospeccao).plano_prospeccao_7dias;
  const days = Array.isArray(rawPlan) ? rawPlan : [];
  const complete = [1, 2, 3, 4, 5, 6, 7].every((n) => {
    const day = days.find((d) => Number(asRecord(d).dia) === n);
    const message = asRecord(day).mensagem;
    return typeof message === "string" && message.trim().length > 0;
  });
  if (!complete) return { ok: false, reason: "plan_incomplete" };

  return { ok: true, usedFallback: resolveUsedFallback(row) };
}

/** A IA respondeu, mas o banco não confirmou a gravação: nada é anunciado como concluído e nada é substituído. */
export function buildPersistenceUnconfirmedError(requestId: string): RefineClientError {
  const safeMessage = "A IA respondeu, mas não foi possível confirmar que a análise foi salva. A análise anterior foi mantida. Atualize a página para conferir; se a nova análise tiver sido gravada, ela aparecerá com a data do último refinamento.";
  return new RefineClientError({
    success: false,
    request_id: requestId,
    public_error_code: createPublicErrorCode(requestId),
    category: "database_error",
    safe_message: safeMessage,
    retryable: false,
    error_code: "REFINE_PERSISTENCE_UNCONFIRMED",
    error_message: safeMessage,
  }, 200, false);
}
