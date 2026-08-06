export interface RefinePersistenceValues {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  plano_prospeccao: Record<string, unknown>;
  ai_analise_gerada_em: string;
  ai_used_fallback: boolean;
  ai_fallback_reason: string | null;
}

export interface PersistedRefineRow {
  id: string;
  diagnostico_bullets: unknown;
  probabilidade_conversao: number | null;
  plano_prospeccao: unknown;
  ai_analise_gerada_em: string | null;
}

export interface RefinePersistenceResult {
  data: PersistedRefineRow[] | null;
  error: { message: string } | null;
}

export type UpdateOwnedLeadAnalysis = (
  leadId: string,
  userId: string,
  values: RefinePersistenceValues,
) => Promise<RefinePersistenceResult>;

export class RefinePersistenceError extends Error {
  readonly code = "REFINE_SAVE_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "RefinePersistenceError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeRefineLeadId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export async function persistOwnedRefineAnalysis(
  updateOwnedLead: UpdateOwnedLeadAnalysis,
  leadId: string,
  userId: string,
  values: RefinePersistenceValues,
): Promise<PersistedRefineRow> {
  const result = await updateOwnedLead(leadId, userId, values);
  if (result.error) {
    throw new RefinePersistenceError(result.error.message);
  }

  const persisted = result.data?.[0];
  if (!persisted?.id || !persisted.ai_analise_gerada_em || !persisted.plano_prospeccao) {
    throw new RefinePersistenceError("A análise não foi confirmada no lead solicitado.");
  }

  return persisted;
}
