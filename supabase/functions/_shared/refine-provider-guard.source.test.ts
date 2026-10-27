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
    expect(source).toContain("await runGuardedRefine({");
    const runAt = source.indexOf("await runGuardedRefine({");
    expect(source.indexOf("diagnostico_bullets: analysis.diagnostico_bullets")).toBeGreaterThan(runAt);
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

  it("a reserva do lead é um UPDATE condicional (compare-and-set) e a gravação só vale com a reserva ainda ativa", () => {
    expect(source).toContain('query.is("ai_fallback_reason", null)');
    expect(source).toContain('query.eq("ai_fallback_reason", prevReason)');
    expect(source).toContain('.eq("ai_fallback_reason", ctx.lockValue)');
    expect(source).toContain("return json(IN_PROGRESS_BODY(requestId), 409)");
  });

  it("nenhuma migration é necessária: usa só colunas que já existem em leads", () => {
    for (const column of ["ai_fallback_reason", "updated_at", "ai_analise_gerada_em", "ai_used_fallback", "plano_prospeccao"]) {
      expect(source).toContain(column);
    }
  });

  it("só cobra depois de confirmar a gravação (saved) da análise", () => {
    const savedCheck = source.indexOf("return !saveError && Boolean(saved?.length)");
    const chargeAt = source.indexOf("increment_ai_usage");
    expect(savedCheck).toBeGreaterThan(0);
    expect(savedCheck).toBeLessThan(chargeAt);
  });

  it("a gravação compara status e análise lidos agora (compare-and-set) e trata o conflito sem cobrar", () => {
    expect(source).toContain('update.is("status", null) : update.eq("status", ctx.expected.status)');
    expect(source).toContain('update.eq("ai_analise_gerada_em", ctx.expected.generatedAt)');
    expect(source).toContain('CONFLICT_BODY(requestId, key), 409');
  });

  it("o tempo limite do provedor cobre também a leitura do corpo da resposta", () => {
    const body = source.indexOf("const data = await response.json()");
    const clear = source.indexOf("clearTimeout(timeout);", body);
    expect(body).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(body);
  });
});
