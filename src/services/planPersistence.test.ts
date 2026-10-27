import { describe, expect, it, vi } from "vitest";
import { applyDayEdit, savePlanDayEdit } from "./planPersistence";
import { makeGeminiPlanDays } from "@/test/leadFixtures";

const edit = { dia: 1, mensagem: "Texto editado", editedAt: "2026-10-27T10:00:00Z" };

describe("applyDayEdit", () => {
  it("objeto da análise: altera só o dia editado e preserva diagnostico, history e versões", () => {
    const days = makeGeminiPlanDays();
    const payload = { plano_prospeccao_7dias: days, diagnostico: { a: 1 }, history: [{ x: 1 }], prompt_version: "v5" };
    const result = applyDayEdit(payload, edit) as typeof payload;
    expect(result.history).toEqual([{ x: 1 }]);
    expect(result.prompt_version).toBe("v5");
    expect(result.plano_prospeccao_7dias[0]).toMatchObject({ dia: 1, mensagem: "Texto editado", is_custom_edited: true, edited_at: edit.editedAt });
    expect(result.plano_prospeccao_7dias.slice(1)).toEqual(days.slice(1));
  });

  it("array legado: mantém o formato e não toca nos outros dias", () => {
    const legacy = [{ dia: 1, mensagem: "a" }, { dia: 2, mensagem: "b" }];
    const result = applyDayEdit(legacy, edit) as Array<Record<string, unknown>>;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ mensagem: "Texto editado", is_custom_edited: true });
    expect(result[1]).toEqual({ dia: 2, mensagem: "b" });
  });

  it("formato antigo sem lista de dias: grava a lista exibida alterando só o dia editado", () => {
    const shown = makeGeminiPlanDays();
    const result = applyDayEdit({ copies: { dia_1: "x" } }, edit, shown) as { copies: unknown; plano_prospeccao_7dias: Array<Record<string, unknown>> };
    expect(result.copies).toEqual({ dia_1: "x" });
    expect(result.plano_prospeccao_7dias).toHaveLength(7);
    expect(result.plano_prospeccao_7dias[0].is_custom_edited).toBe(true);
    expect(result.plano_prospeccao_7dias[1].is_custom_edited).toBeUndefined();
  });

  it("e-mail: grava assunto junto, sem prefixo no corpo", () => {
    const days = [{ dia: 3, canal: "email", mensagem: "corpo", assunto_email: "velho" }];
    const [d] = applyDayEdit(days, { dia: 3, mensagem: "novo corpo", assunto_email: "novo assunto", editedAt: "t" }) as Array<Record<string, unknown>>;
    expect(d).toMatchObject({ mensagem: "novo corpo", assunto_email: "novo assunto" });
  });
});

describe("savePlanDayEdit", () => {
  it("lê o plano salvo, aplica a edição e faz UM update; nenhuma função de IA envolvida", async () => {
    const days = makeGeminiPlanDays();
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { plano_prospeccao: { plano_prospeccao_7dias: days } }, error: null }) }) }),
        update,
      }),
    };
    await savePlanDayEdit(client as never, "lead-1", edit, days);
    expect(update).toHaveBeenCalledTimes(1);
    const sent = (update.mock.calls[0] as unknown as [{ plano_prospeccao: { plano_prospeccao_7dias: unknown[] } }])[0];
    expect(sent.plano_prospeccao.plano_prospeccao_7dias).toHaveLength(7);
  });

  it("propaga erro de leitura sem gravar nada", async () => {
    const update = vi.fn();
    const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: "sem permissão" } }) }) }), update }) };
    await expect(savePlanDayEdit(client as never, "lead-1", edit, [])).rejects.toThrow("sem permissão");
    expect(update).not.toHaveBeenCalled();
  });
});
