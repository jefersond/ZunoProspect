import { describe, expect, it } from "vitest";
import {
  GEMINI_JSON_MIME_TYPE,
  REFINE_MODELS,
  buildProviderFailure,
  shouldChargeCredit,
  shouldPersistAnalysis,
  summarizeProviderError,
  validateAnalysis,
} from "./refine-provider-guard";

const day = (dia: number, extra: Record<string, unknown> = {}) => ({
  dia,
  canal: "whatsapp",
  acao_sugerida: `Ação ${dia}`,
  mensagem: `Mensagem específica do dia ${dia}`,
  objecao_provavel: "Já temos fornecedor.",
  resposta_sugerida: "Entendo.",
  cta: "Faz sentido?",
  ...extra,
});
const valid = () => ({
  diagnostico_bullets: ["a", "b", "c"],
  probabilidade_conversao: 61,
  fit_level: "medio",
  commercial_opportunity: "op",
  probable_pain: "dor",
  messages: { whatsapp_primary: "w", instagram: "i", email_body: "e" },
  plano_prospeccao_7dias: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d)),
});

describe("contrato com o Gemini", () => {
  it("usa o valor de enum aceito pela API, não o MIME em minúsculas que gera HTTP 400", () => {
    expect(GEMINI_JSON_MIME_TYPE).toBe("APPLICATION_JSON");
  });

  it("não repete o modelo aposentado que a API redireciona para o primeiro", () => {
    expect(REFINE_MODELS).not.toContain("gemini-3.5-flash");
    expect(new Set(REFINE_MODELS).size).toBe(REFINE_MODELS.length);
  });
});

describe("validateAnalysis: resposta incompleta nunca vira plano genérico", () => {
  it("aceita uma análise completa e preserva as mensagens exatamente", () => {
    const result = validateAnalysis(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plano_prospeccao_7dias).toHaveLength(7);
      expect(result.value.plano_prospeccao_7dias[0].mensagem).toBe("Mensagem específica do dia 1");
    }
  });

  it("recusa menos de 3 tópicos de diagnóstico (antes era completado com texto de reserva)", () => {
    const raw = { ...valid(), diagnostico_bullets: ["só um"] };
    expect(validateAnalysis(raw)).toEqual({ ok: false, reason: "diagnostico_incomplete" });
  });

  it("recusa plano sem algum dos 7 dias (antes o dia ausente era substituído pela copy de reserva)", () => {
    const raw = { ...valid(), plano_prospeccao_7dias: [1, 2, 3, 4, 5, 7].map((d) => day(d)) };
    expect(validateAnalysis(raw)).toEqual({ ok: false, reason: "plan_day_6_missing" });
  });

  it("recusa dia com mensagem vazia", () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, d === 3 ? { mensagem: "  " } : {}));
    expect(validateAnalysis({ ...valid(), plano_prospeccao_7dias: days })).toEqual({ ok: false, reason: "plan_day_3_incomplete" });
  });

  it("recusa probabilidade ausente e respostas que não são objeto", () => {
    expect(validateAnalysis({ ...valid(), probabilidade_conversao: undefined }).ok).toBe(false);
    expect(validateAnalysis(null).ok).toBe(false);
    expect(validateAnalysis([]).ok).toBe(false);
    expect(validateAnalysis("texto").ok).toBe(false);
  });

  it("só troca o canal inválido pelo padrão; o texto continua do modelo", () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, d === 2 ? { canal: "telegrama" } : {}));
    const result = validateAnalysis({ ...valid(), plano_prospeccao_7dias: days }, "email");
    expect(result.ok && result.value.plano_prospeccao_7dias[1].canal).toBe("email");
    expect(result.ok && result.value.plano_prospeccao_7dias[1].mensagem).toBe("Mensagem específica do dia 2");
  });
});

describe("persistência e cobrança", () => {
  it("análise inválida não grava e não cobra", () => {
    const invalid = validateAnalysis({});
    expect(shouldPersistAnalysis(invalid)).toBe(false);
    expect(shouldChargeCredit(invalid, false)).toBe(false);
  });

  it("análise válida grava; cobra só quem não é administrador", () => {
    const ok = validateAnalysis(valid());
    expect(shouldPersistAnalysis(ok)).toBe(true);
    expect(shouldChargeCredit(ok, false)).toBe(true);
    expect(shouldChargeCredit(ok, true)).toBe(false);
  });
});

describe("buildProviderFailure", () => {
  it("falha do provedor: 502, success false, sem fallback, sem gravação, sem crédito, repetível", () => {
    const f = buildProviderFailure("req-1", "gemini-3.6-flash:400");
    expect(f.status).toBe(502);
    expect(f.body).toMatchObject({
      success: false,
      error_code: "REFINE_PROVIDER_UNAVAILABLE",
      category: "provider_error",
      retryable: true,
      used_fallback: false,
      credit_consumed: false,
      saved: false,
    });
    expect(f.body.safe_message).toMatch(/crédito não foi consumido/i);
    expect(f.body.safe_message).toMatch(/anterior foi mantida/i);
  });

  it("chave ausente: 503 de configuração, sem prometer nova tentativa", () => {
    const f = buildProviderFailure("req-2", "gemini_key_missing");
    expect(f.status).toBe(503);
    expect(f.body.error_code).toBe("REFINE_CONFIGURATION_MISSING");
    expect(f.body.retryable).toBe(false);
  });

  it("a mensagem pública não vaza o motivo interno", () => {
    expect(JSON.stringify(buildProviderFailure("req-3", "gemini-3.6-flash:400"))).not.toMatch(/gemini-3|400/);
  });
});

describe("summarizeProviderError", () => {
  it("extrai status e mensagem do corpo de erro do Gemini", () => {
    const body = JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", message: 'Invalid value at generation_config.response_format.text.mime_type' } });
    expect(summarizeProviderError(body)).toBe("INVALID_ARGUMENT: Invalid value at generation_config.response_format.text.mime_type");
  });

  it("mascara chave de API que apareça no corpo e limita o tamanho", () => {
    const out = summarizeProviderError(`key=AIza${"x".repeat(35)} ${"y".repeat(500)}`, 120);
    expect(out).not.toMatch(/AIza/);
    expect(out.length).toBeLessThanOrEqual(120);
  });
});
