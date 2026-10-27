import { describe, expect, it } from "vitest";
import { normalizeRefineError } from "@/lib/refineObservability";
import { buildRefineOutcomeError, classifyRefineResponse, getAnalysisOrigin } from "./refineOutcome";

describe("classifyRefineResponse", () => {
  it("análise do Gemini: gerada", () => {
    expect(classifyRefineResponse({ success: true, model: "gemini-3.6-flash", used_fallback: false }).kind).toBe("generated");
  });

  it.each([
    ["used_fallback", { success: true, used_fallback: true, model: "contextual-fallback", fallback_reason: "gemini-3.1-flash-lite:400" }],
    ["somente o modelo de reserva", { success: true, model: "contextual-fallback" }],
    ["somente debug.fallback_used", { success: true, model: "x", debug: { fallback_used: true } }],
  ])("HTTP 200 com texto de reserva (%s) NÃO é análise gerada", (_n, body) => {
    expect(classifyRefineResponse(body).kind).toBe("fallback");
  });

  it("success:false dentro de HTTP 200 é falha", () => {
    expect(classifyRefineResponse({ success: false, error_code: "REFINE_PROVIDER_UNAVAILABLE" })).toMatchObject({
      kind: "failed",
      reason: "REFINE_PROVIDER_UNAVAILABLE",
    });
  });

  it.each([[null], [undefined], [{}], ["texto"], [[]]])("resposta vazia ou inesperada (%j) é falha", (body) => {
    expect(classifyRefineResponse(body).kind).toBe("failed");
  });
});

describe("buildRefineOutcomeError", () => {
  it("é erro de provedor, repetível, sem cobrança, e não diz que a análise foi concluída", () => {
    const err = buildRefineOutcomeError({ kind: "fallback", model: "contextual-fallback", reason: "x" }, "req-1");
    expect(err.payload).toMatchObject({ success: false, category: "provider_error", retryable: true, credit_consumed: false });
    expect(err.payload.safe_message).toMatch(/genérico de reserva/i);
    expect(err.payload.safe_message).not.toMatch(/conclu[ií]da com sucesso/i);
  });
});

describe("erro 502 do backend corrigido chega com mensagem clara e sem cobrança", () => {
  it("usa a safe_message do servidor e mantém credit_consumed=false", async () => {
    const body = {
      success: false,
      request_id: "req-502",
      error_code: "REFINE_PROVIDER_UNAVAILABLE",
      category: "provider_error",
      retryable: true,
      safe_message: "Não foi possível gerar a análise com IA agora. Seu crédito não foi consumido e a análise anterior foi mantida. Tente novamente em alguns instantes.",
      credit_consumed: false,
    };
    const res = new Response(JSON.stringify(body), { status: 502, headers: { "Content-Type": "application/json" } });
    const normalized = await normalizeRefineError({ message: "Edge Function returned a non-2xx status code", context: res }, "fallback-id");
    expect(normalized.payload.safe_message).toBe(body.safe_message);
    expect(normalized.payload.category).toBe("provider_error");
    expect(normalized.payload.credit_consumed).toBe(false);
    expect(normalized.payload.retryable).toBe(true);
  });
});

describe("getAnalysisOrigin", () => {
  it("sem análise salva: não gerado", () => {
    expect(getAnalysisOrigin({ ai_analise_gerada_em: null })).toBe("not_generated");
  });
  it("marcado como reserva: fallback", () => {
    expect(getAnalysisOrigin({ ai_analise_gerada_em: "2026-10-27", ai_used_fallback: true })).toBe("fallback");
  });
  it("marcado como não reserva: gemini", () => {
    expect(getAnalysisOrigin({ ai_analise_gerada_em: "2026-10-27", ai_used_fallback: false })).toBe("gemini");
  });
  it("sem a informação: desconhecida (a tela não afirma nada)", () => {
    expect(getAnalysisOrigin({ ai_analise_gerada_em: "2026-10-27" })).toBe("unknown");
  });
});
