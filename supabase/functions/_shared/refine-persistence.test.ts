import { describe, expect, it, vi } from "vitest";
import {
  normalizeRefineLeadId,
  persistOwnedRefineAnalysis,
  RefinePersistenceError,
  type RefinePersistenceValues,
} from "./refine-persistence.ts";

const values: RefinePersistenceValues = {
  diagnostico_bullets: ["bullet 1", "bullet 2", "bullet 3"],
  probabilidade_conversao: 72,
  plano_prospeccao: { cadence: {} },
  ai_analise_gerada_em: "2026-08-06T00:00:00.000Z",
  ai_used_fallback: false,
  ai_fallback_reason: null,
};

describe("normalizeRefineLeadId — guards against malformed/missing lead references", () => {
  it("accepts a well-formed uuid", () => {
    expect(normalizeRefineLeadId("8fd50939-bbef-4dc6-a337-aa8168cc25d1")).toBe(
      "8fd50939-bbef-4dc6-a337-aa8168cc25d1",
    );
  });

  it("rejects non-uuid strings instead of silently trusting client input", () => {
    expect(normalizeRefineLeadId("not-a-uuid")).toBeNull();
    expect(normalizeRefineLeadId("")).toBeNull();
    expect(normalizeRefineLeadId(undefined)).toBeNull();
    expect(normalizeRefineLeadId(12345)).toBeNull();
  });
});

describe("persistOwnedRefineAnalysis — atomic, ownership-scoped persistence", () => {
  it("returns the persisted row when the owned update confirms all required fields", async () => {
    const update = vi.fn().mockResolvedValue({
      data: [{ id: "lead-1", ...values, plano_prospeccao: values.plano_prospeccao }],
      error: null,
    });
    const result = await persistOwnedRefineAnalysis(update, "lead-1", "user-1", values);
    expect(result.id).toBe("lead-1");
    expect(update).toHaveBeenCalledWith("lead-1", "user-1", values);
  });

  it("throws instead of reporting success when the database reports an error", async () => {
    const update = vi.fn().mockResolvedValue({ data: null, error: { message: "db unavailable" } });
    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values)).rejects.toBeInstanceOf(
      RefinePersistenceError,
    );
  });

  it("throws when the update touches zero rows (lead not owned by this user / already deleted)", async () => {
    // Isso é o que acontece quando o .eq('user_id', userId) não bate com nenhuma linha: o
    // Supabase retorna sucesso com um array vazio em vez de um erro. Sem essa checagem, o
    // backend responderia "sucesso" para uma análise que nunca foi de fato salva.
    const update = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values)).rejects.toBeInstanceOf(
      RefinePersistenceError,
    );
  });

  it("throws when the returned row is missing the confirmation fields", async () => {
    const update = vi.fn().mockResolvedValue({
      data: [{ id: "lead-1", ai_analise_gerada_em: null, plano_prospeccao: null }],
      error: null,
    });
    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values)).rejects.toThrow(
      /não foi confirmada/,
    );
  });
});
