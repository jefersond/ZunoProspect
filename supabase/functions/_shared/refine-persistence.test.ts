import { describe, expect, it, vi } from "vitest";
import {
  RefinePersistenceError,
  normalizeRefineLeadId,
  persistOwnedRefineAnalysis,
  type RefinePersistenceValues,
} from "./refine-persistence";

const values: RefinePersistenceValues = {
  diagnostico_bullets: ["Leitura comercial específica"],
  probabilidade_conversao: 72,
  plano_prospeccao: { plano_prospeccao_7dias: [{ dia: 1 }] },
  ai_analise_gerada_em: "2026-07-26T12:00:00.000Z",
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

describe("refine persistence", () => {
  it("returns only after the owned lead update is confirmed", async () => {
    const update = vi.fn().mockResolvedValue({
      data: [{
        id: "lead-1",
        diagnostico_bullets: values.diagnostico_bullets,
        probabilidade_conversao: 72,
        plano_prospeccao: values.plano_prospeccao,
        ai_analise_gerada_em: values.ai_analise_gerada_em,
      }],
      error: null,
    });

    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values))
      .resolves.toMatchObject({ id: "lead-1", probabilidade_conversao: 72 });
    expect(update).toHaveBeenCalledWith("lead-1", "user-1", values);
  });

  it("fails when the database update returns an error", async () => {
    const update = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values))
      .rejects.toBeInstanceOf(RefinePersistenceError);
  });

  it("fails when no owned row was persisted", async () => {
    const update = vi.fn().mockResolvedValue({ data: [], error: null });

    await expect(persistOwnedRefineAnalysis(update, "lead-1", "user-1", values))
      .rejects.toMatchObject({ code: "REFINE_SAVE_FAILED" });
  });
});
