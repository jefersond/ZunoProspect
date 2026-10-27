if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "mock-anon-key";

import { describe, expect, it } from "vitest";
import { normalizeDiagnosticoBullets, normalizePlanoProspeccao } from "@/utils/normalizeLead";
import { getSdrMessageFromPlan, resolveDayType } from "./intelligentSevenDayPlan";
import { normalizeRefineError } from "@/lib/refineObservability";
import { buildRefineFailure } from "../../supabase/functions/_shared/refine-failure";
import { runAnalysisPipeline, type PipelineFailure } from "../../supabase/functions/_shared/analysis-pipeline";
import { createFakeGeminiFetch } from "../../supabase/functions/_shared/gemini-contract";
import { goodRaw, lead, profile } from "../../supabase/functions/_shared/test-fixtures";
import { sanitizeSellerProfile } from "../../supabase/functions/_shared/lead-analysis";
import type { LeadProspeccao } from "@/types/lead";

/** Formato gravado pela Edge Function ANTIGA (prompt v4). Dias sempre com 7 mensagens e sem tipo_dia. */
const oldFunctionPayload = () => ({
  lead_id: "lead-old", generated_at: "2026-10-20T10:00:00Z", prompt_version: "v4_human_commercial_plan", model: "gemini-3.6-flash",
  diagnostico: { fit: "medio", dor_provavel: "Oscilação no volume de novos clientes", oportunidade: "Estruturar captação local", justificativa: "Empresa atua em Serra" },
  copies: { dia_1: "Texto do dia 1" },
  plano_prospeccao_7dias: Array.from({ length: 7 }, (_, i) => ({
    dia: i + 1, canal: i % 2 ? "instagram" : "whatsapp", acao_sugerida: `Ação ${i + 1}`, mensagem: `Mensagem antiga ${i + 1} escrita pela v4`,
    objecao_provavel: "Sem tempo", resposta_sugerida: "Sem problema", cta: "Faz sentido?",
  })),
});

describe("frontend NOVO lendo dados gravados pela Edge Function ANTIGA", () => {
  it("plano antigo (objeto v4): 7 dias intactos, tratados como mensagem, texto do SDR idêntico ao salvo", () => {
    const payload = oldFunctionPayload();
    const days = normalizePlanoProspeccao(payload);
    expect(days).toHaveLength(7);
    const leadRow = { ...lead, plano_prospecao_7dias: days } as unknown as LeadProspeccao;
    for (const d of days) {
      expect(resolveDayType(d)).toBe("mensagem");
      expect(getSdrMessageFromPlan(leadRow, d.dia).text).toBe(d.mensagem);
    }
  });

  it("diagnóstico antigo sem bullets na coluna: reaproveita o objeto salvo, sem texto novo inventado", () => {
    const bullets = normalizeDiagnosticoBullets(null, { plano_prospeccao: oldFunctionPayload() });
    expect(bullets.join(" ")).toContain("Empresa atua em Serra");
    expect(normalizeDiagnosticoBullets(null, { nome: "X" })).toEqual([]);
  });

  it("plano antigo gravado como array puro também continua legível", () => {
    const days = normalizePlanoProspeccao(oldFunctionPayload().plano_prospeccao_7dias);
    expect(days).toHaveLength(7);
  });

  it("lead sem nenhuma análise: nada é inventado", () => {
    expect(normalizePlanoProspeccao(null)).toEqual([]);
    expect(normalizePlanoProspeccao({})).toEqual([]);
  });
});

describe("Edge Function NOVA devolvendo dados para o frontend ANTIGO", () => {
  const run = (over: Record<string, unknown> = {}) => {
    const fake = createFakeGeminiFetch({ script: [{ status: 200, text: JSON.stringify(goodRaw()) }] });
    return runAnalysisPipeline(
      { apiKey: "k", fetchFn: fake.fetchFn as never, now: () => "2026-10-27T12:00:00Z", persist: async () => true, consumeCredit: async () => true },
      { leadId: "l1", requestId: "r1", profile, rawLead: lead, existingPlan: null, replaceExisting: false, isAdmin: false, ...over },
    );
  };

  it("o payload mantém os campos que o frontend antigo lê (dias com campos legados e bullets como texto)", async () => {
    const out = await run();
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(Array.isArray(out.payload.diagnostico_bullets)).toBe(true);
    expect(out.payload.diagnostico_bullets.every((b) => typeof b === "string")).toBe(true);
    for (const d of out.payload.plano_prospeccao_7dias as unknown as Array<Record<string, unknown>>) {
      for (const key of ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]) {
        expect(typeof d[key] === "string" || typeof d[key] === "number").toBe(true);
      }
    }
    // o frontend novo reconstrói os dias exatamente
    expect(normalizePlanoProspeccao(out.payload)).toHaveLength(7);
  });

  it("frontend antigo não envia seller_profile: a função responde 422 com mensagem segura que o cliente antigo já exibe", async () => {
    const out = await run({ profile: sanitizeSellerProfile(undefined) });
    expect(out).toMatchObject({ ok: false, code: "REFINE_PROFILE_REQUIRED", status: 422, providerBilling: "not_called" });
    const failed = out as PipelineFailure;
    const built = buildRefineFailure("8fd50939-bbef-4dc6-a337-aa8168cc25d1", failed.code, failed.status, failed.message, failed.extra);
    const error = await normalizeRefineError({ message: "non-2xx", context: new Response(JSON.stringify(built.body), { status: built.status }) }, "fallback");
    expect(error.payload).toMatchObject({ error_code: "REFINE_PROFILE_REQUIRED", retryable: false, safe_message: failed.message, credit_consumed: false });
    expect(error.retryConfirmedByBackend).toBe(true);
  });
});

describe("contrato de erro: o cliente interpreta todos os códigos novos da função", () => {
  it.each([
    ["REFINE_PROFILE_REQUIRED", 422, false],
    ["REFINE_PLAN_EXISTS", 409, false],
    ["REFINE_LEAD_OPTED_OUT", 409, false],
    ["REFINE_PROVIDER_INVALID_REQUEST", 502, false],
    ["REFINE_PROVIDER_AUTH_FAILED", 503, false],
    ["REFINE_PROVIDER_INVALID_RESPONSE", 502, true],
    ["REFINE_PROVIDER_UNAVAILABLE", 503, true],
  ])("%s (HTTP %i, retryable=%s)", async (code, status, retryable) => {
    const built = buildRefineFailure("8fd50939-bbef-4dc6-a337-aa8168cc25d1", code, status, "Mensagem segura de teste.");
    const error = await normalizeRefineError({ message: "non-2xx", context: new Response(JSON.stringify(built.body), { status }) }, "fb");
    expect(error.payload).toMatchObject({ success: false, error_code: code, retryable, safe_message: "Mensagem segura de teste.", credit_consumed: false });
    expect(error.retryConfirmedByBackend).toBe(true);
  });
});
