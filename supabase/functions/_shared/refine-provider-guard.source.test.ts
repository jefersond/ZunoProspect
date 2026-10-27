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

  it("gravação e cobrança acontecem somente dentro de runRefine (provedor → gravação → cobrança)", () => {
    expect(source).toContain("await runRefine({");
    const runAt = source.indexOf("await runRefine({");
    expect(source.indexOf('.update({')).toBeGreaterThan(runAt);
    expect(source.indexOf("increment_ai_usage")).toBeGreaterThan(runAt);
    expect(source.match(/increment_ai_usage/g)).toHaveLength(1);
  });

  it("nunca marca a análise como reserva", () => {
    expect(source).toContain("ai_used_fallback: false");
    expect(source).not.toMatch(/ai_used_fallback:\s*usedFallback/);
  });

  it("max_provider_attempts só reduz as tentativas ao provedor", () => {
    expect(source).toContain("Math.min(requested, MODELS.length)");
    expect(source).toContain("MODELS.slice(0, maxAttempts)");
  });

  it("não afirma ausência de pixel/tags enquanto a inspeção de HTML está suspensa", () => {
    expect(source).toContain("inspeção automática do HTML do site está suspensa");
  });

  it("duplicata é resolvida antes de chamar o Gemini e antes de cobrar", () => {
    const dupAt = source.indexOf("isDuplicateRefine(");
    const geminiAt = source.indexOf("await callGemini(GEMINI_KEY");
    const chargeAt = source.indexOf("increment_ai_usage");
    expect(dupAt).toBeGreaterThan(0);
    expect(dupAt).toBeLessThan(geminiAt);
    expect(dupAt).toBeLessThan(chargeAt);
  });

  it("só cobra depois de confirmar a gravação (saved) da análise", () => {
    const savedCheck = source.indexOf("return !saveError && Boolean(saved?.length)");
    const chargeAt = source.indexOf("increment_ai_usage");
    expect(savedCheck).toBeGreaterThan(0);
    expect(savedCheck).toBeLessThan(chargeAt);
  });
});
