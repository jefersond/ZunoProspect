import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressão de leitura do código: a função hospedada não roda no vitest (Deno), então estas verificações
// travam os pontos que causaram a análise genérica anunciada como sucesso.
const source = readFileSync(new URL("../analisar-lead-ia/index.ts", import.meta.url), "utf8");

describe("analisar-lead-ia: sem análise genérica disfarçada de IA", () => {
  it("envia o enum de MIME aceito pela API e nunca o texto em minúsculas", () => {
    expect(source).toContain("mimeType: GEMINI_JSON_MIME_TYPE");
    expect(source).not.toMatch(/mimeType:\s*"application\/json"/);
  });

  it("não tem mais o gerador de reserva nem o modelo 'contextual-fallback'", () => {
    expect(source).not.toContain("fallbackAnalysis");
    expect(source).not.toContain("contextual-fallback");
  });

  it("falha do provedor devolve erro antes de qualquer gravação ou cobrança", () => {
    const failureAt = source.indexOf("buildProviderFailure(requestId, provider.error)");
    const updateAt = source.indexOf('.from("leads")\n      .update(');
    const chargeAt = source.indexOf("increment_ai_usage");
    expect(failureAt).toBeGreaterThan(0);
    expect(failureAt).toBeLessThan(updateAt);
    expect(failureAt).toBeLessThan(chargeAt);
  });

  it("cobra crédito somente por meio da regra validada e nunca marca a análise como reserva", () => {
    expect(source).toContain("shouldChargeCredit(validation, isAdmin)");
    expect(source).toContain("ai_used_fallback: false");
    expect(source).not.toMatch(/ai_used_fallback:\s*usedFallback/);
  });

  it("não afirma ausência de pixel/tags enquanto a inspeção de HTML está suspensa", () => {
    expect(source).toContain("inspeção automática do HTML do site está suspensa");
  });
});
