export const REFINE_PROVIDER_TOTAL_BUDGET_MS = 45_000;
export const REFINE_PROVIDER_MIN_ATTEMPT_MS = 5_000;

export function parseRetryAfterSeconds(
  value: string | null,
  fallbackSeconds: number,
  nowMs = Date.now(),
): number {
  if (value) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      return Math.min(60, Math.max(1, Math.ceil(numericValue)));
    }
    const retryDate = Date.parse(value);
    if (Number.isFinite(retryDate)) {
      return Math.min(60, Math.max(1, Math.ceil((retryDate - nowMs) / 1000)));
    }
  }
  return Math.min(30, Math.max(1, Math.ceil(fallbackSeconds)));
}

export function computeProviderRetryDelay(
  status: number,
  attempt: number,
  retryAfterHeader: string | null,
  randomValue = Math.random(),
): { retryAfterSeconds: number; delayMs: number } {
  const fallbackSeconds = status === 429
    ? Math.min(30, 2 ** attempt)
    : Math.min(4, 2 ** Math.max(0, attempt - 1));
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader, fallbackSeconds);
  const boundedRandom = Math.max(0, Math.min(0.999, randomValue));
  return {
    retryAfterSeconds,
    delayMs: retryAfterSeconds * 1_000 + Math.floor(boundedRandom * 500),
  };
}

export function hasProviderRetryBudget(
  remainingBudgetMs: number,
  delayMs: number,
  minimumAttemptMs = REFINE_PROVIDER_MIN_ATTEMPT_MS,
): boolean {
  return remainingBudgetMs - delayMs >= minimumAttemptMs;
}
