import { describe, expect, it } from "vitest";
import {
  buildProspectingQualityContract,
  preserveDiagnosisOrFallback,
  validateProspectingAnalysis,
  type ProspectingAnalysis,
  type ProspectingDay,
} from "./refine-quality.ts";

function buildDay(overrides: Partial<ProspectingDay> = {}): ProspectingDay {
  return {
    dia: 1,
    canal: "whatsapp",
    acao_sugerida: "Enviar mensagem curta de abertura personalizada",
    mensagem: "Olá, tudo bem? Vi que vocês atuam em Belo Horizonte e queria entender como está a rotina de novos clientes hoje.",
    objecao_provavel: "Não tenho interesse agora",
    resposta_sugerida: "Sem problema, fico à disposição se mudar de ideia mais pra frente.",
    cta: "Faz sentido eu te mandar um exemplo rápido?",
    ...overrides,
  };
}

function buildValidPlan(): ProspectingDay[] {
  return Array.from({ length: 7 }, (_, index) =>
    buildDay({ dia: index + 1, mensagem: `Mensagem única e específica do dia ${index + 1}, com contexto real do lead e um convite claro para continuar a conversa.` }));
}

function buildValidAnalysis(): ProspectingAnalysis {
  return {
    diagnostico_bullets: [
      "A empresa atua no nicho de estética em Belo Horizonte e tem Instagram ativo com bom engajamento.",
      "O site não tem WhatsApp visível, o que pode estar perdendo contatos de quem chega pela busca.",
      "Não há Meta Pixel nem Google Analytics instalados, então não há como medir a origem dos leads hoje.",
    ],
    plano_prospeccao_7dias: buildValidPlan(),
  };
}

describe("validateProspectingAnalysis — regression contract for the 7-day plan", () => {
  it("accepts a complete, well-formed analysis (regression baseline)", () => {
    expect(validateProspectingAnalysis(buildValidAnalysis())).toEqual([]);
  });

  it("rejects fewer than 3 diagnostic bullets", () => {
    const analysis = buildValidAnalysis();
    analysis.diagnostico_bullets = analysis.diagnostico_bullets!.slice(0, 2);
    expect(validateProspectingAnalysis(analysis)).toContain("diagnostico_invalido");
  });

  it("rejects more than 4 diagnostic bullets", () => {
    const analysis = buildValidAnalysis();
    analysis.diagnostico_bullets = [...analysis.diagnostico_bullets!, "Bullet extra", "Outro bullet extra"];
    expect(validateProspectingAnalysis(analysis)).toContain("diagnostico_invalido");
  });

  it("rejects a plan with fewer than 7 days and stops there (no point checking day content)", () => {
    const analysis = buildValidAnalysis();
    analysis.plano_prospeccao_7dias = analysis.plano_prospeccao_7dias!.slice(0, 5);
    expect(validateProspectingAnalysis(analysis)).toEqual(["plano_deve_ter_7_dias"]);
  });

  it("rejects a day missing required fields (e.g. an empty message)", () => {
    const analysis = buildValidAnalysis();
    analysis.plano_prospeccao_7dias![2] = buildDay({ dia: 3, mensagem: "" });
    expect(validateProspectingAnalysis(analysis)).toContain("dia_3_incompleto");
  });

  it("rejects duplicated messages across days (no copy-pasted cadence)", () => {
    const analysis = buildValidAnalysis();
    analysis.plano_prospeccao_7dias![3] = buildDay({
      dia: 4,
      mensagem: analysis.plano_prospeccao_7dias![0].mensagem,
    });
    expect(validateProspectingAnalysis(analysis)).toContain("mensagens_duplicadas");
  });

  it("rejects a plan whose day numbers skip 1-7", () => {
    const analysis = buildValidAnalysis();
    analysis.plano_prospeccao_7dias![6] = buildDay({ dia: 9 });
    expect(validateProspectingAnalysis(analysis)).toContain("dias_invalidos");
  });
});

describe("preserveDiagnosisOrFallback — never silently blanks a real diagnosis", () => {
  it("keeps the AI's own bullets when there are at least 3", () => {
    const analysis = buildValidAnalysis();
    const preserved = preserveDiagnosisOrFallback(analysis, ["fallback bullet"]);
    expect(preserved).toEqual(analysis.diagnostico_bullets);
  });

  it("uses the fallback bullets only when the AI diagnosis is too thin to be useful", () => {
    const analysis: ProspectingAnalysis = { diagnostico_bullets: ["only one bullet"] };
    const fallback = ["fallback bullet 1", "fallback bullet 2", "fallback bullet 3"];
    expect(preserveDiagnosisOrFallback(analysis, fallback)).toEqual(fallback.slice(0, 4));
  });
});

describe("buildProspectingQualityContract", () => {
  it("still mandates all 7 required sections of the refine deliverable", () => {
    const contract = buildProspectingQualityContract();
    expect(contract).toMatch(/3 ou 4 diagnostico_bullets/);
    expect(contract).toMatch(/7 dias/);
    for (const day of ["Dia 1", "Dia 2", "Dia 3", "Dia 4", "Dia 5", "Dia 6", "Dia 7"]) {
      expect(contract).toContain(day);
    }
  });
});
