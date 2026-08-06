import { describe, expect, it } from "vitest";
import {
  buildProspectingQualityContract,
  preserveDiagnosisOrFallback,
  validateProspectingAnalysis,
  type ProspectingDay,
} from "./refine-quality";

const validDays = Array.from({ length: 7 }, (_, index): ProspectingDay => ({
  dia: index + 1,
  canal: index === 3 ? "email" : "whatsapp",
  acao_sugerida: `Executar contato consultivo específico do dia ${index + 1}`,
  mensagem: `Olá, empresa. Esta é uma mensagem contextual e exclusiva do dia ${index + 1}, baseada em um sinal real e terminando com uma pergunta simples?`,
  objecao_provavel: `Objeção plausível e específica do dia ${index + 1}`,
  resposta_sugerida: `Resposta consultiva, respeitosa e suficiente para a objeção do dia ${index + 1}.`,
  cta: `Faz sentido conversar sobre o ponto ${index + 1}?`,
}));

describe("refine quality contract", () => {
  it("accepts a complete, unique seven-day analysis", () => {
    expect(validateProspectingAnalysis({
      diagnostico_bullets: [
        "O site informado cria uma base concreta para avaliar clareza da oferta e caminho de contato.",
        "A presença de WhatsApp sugere facilidade de conversa, mas a velocidade do atendimento ainda precisa ser validada.",
        "A melhor abertura conecta o sinal observado a uma pergunta sobre o processo comercial atual.",
      ],
      plano_prospeccao_7dias: validDays,
    })).toEqual([]);
  });

  it("rejects incomplete and duplicated plans", () => {
    expect(validateProspectingAnalysis({
      diagnostico_bullets: ["Curto"],
      plano_prospeccao_7dias: [...validDays.slice(0, 6), { ...validDays[5], dia: 6 }],
    })).toEqual(expect.arrayContaining(["diagnostico_invalido", "mensagens_duplicadas", "dias_invalidos"]));
  });

  it("preserves a valid AI diagnosis instead of overwriting it", () => {
    const aiBullets = [
      "Primeira conclusão comercial específica baseada no site informado pela empresa.",
      "Segunda conclusão distingue o sinal observado da hipótese que ainda precisa ser validada.",
      "Terceira conclusão recomenda uma abertura coerente com o foco selecionado.",
    ];
    expect(preserveDiagnosisOrFallback({ diagnostico_bullets: aiBullets }, ["fallback"]))
      .toEqual(aiBullets);
  });

  it("defines one unambiguous final output contract", () => {
    const contract = buildProspectingQualityContract();
    expect(contract).toContain("exatamente 3 ou 4 diagnostico_bullets");
    expect(contract).toContain("exatamente 7 dias");
    expect(contract).toContain("sem repetir mensagem");
  });
});
