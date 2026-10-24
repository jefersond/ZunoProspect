import { describe, it, expect } from "vitest";
import { calculateLeadCompatibilityScore } from "./leadCompatibilityScore";
import type { LeadProspeccao } from "@/types/lead";

describe("leadCompatibilityScore", () => {
  const completeLead: Partial<LeadProspeccao> = {
    id: "lead-1",
    nome: "Clínica Sorriso Perfeito",
    telefone: "(27) 99888-7766",
    whatsapp_number: "27998887766",
    website: "https://clinicasorriso.com.br",
    cidade: "Vitória",
    nicho: "Odontologia",
    endereco: "Av. Reta da Penha, 1000 - Praia do Canto",
    total_reviews: 42,
    rating: 4.9,
    sinais: {
      has_whatsapp_on_site: true,
      has_meta_pixel: true,
      has_gtag: true,
      has_gtm: false,
    },
  };

  it("deve calcular score alto (>= 70) para lead completo com dados verificáveis", () => {
    const result = calculateLeadCompatibilityScore(completeLead, {
      userServiceName: "Gestão de Tráfego Pago",
      minScoreThreshold: 70,
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.ratingLevel).toBe("alta");
    expect(result.isPrioritySDR).toBe(true);
    expect(result.dadosUtilizados.length).toBeGreaterThan(4);
    expect(result.motivos.some((m) => m.includes("WhatsApp"))).toBe(true);
    expect(result.motivos.some((m) => m.includes("Website"))).toBe(true);
    expect(result.motivos.some((m) => m.includes("reputação") || m.includes("avaliações"))).toBe(true);
  });

  it("deve respeitar o threshold configurável de nota mínima", () => {
    // Com threshold 99, um lead de score 95 não deve ser prioridade SDR
    const resultStrict = calculateLeadCompatibilityScore(completeLead, {
      minScoreThreshold: 99,
    });
    expect(resultStrict.isPrioritySDR).toBe(false);

    // Com threshold 70, deve ser prioridade
    const resultRelaxed = calculateLeadCompatibilityScore(completeLead, {
      minScoreThreshold: 70,
    });
    expect(resultRelaxed.isPrioritySDR).toBe(true);
  });

  it("deve calcular score baixo para lead sem dados de contato e sem presença digital", () => {
    const emptyLead: Partial<LeadProspeccao> = {
      id: "lead-2",
      nome: "Comércio Local Desconhecido",
      cidade: "Vitória",
      nicho: "Varejo",
    };

    const result = calculateLeadCompatibilityScore(emptyLead, { minScoreThreshold: 70 });

    expect(result.score).toBeLessThan(40);
    expect(result.ratingLevel).toBe("baixa");
    expect(result.isPrioritySDR).toBe(false);
    expect(result.dadosNaoVerificados.some((nv) => nv.includes("Telefone"))).toBe(true);
    expect(result.dadosNaoVerificados.some((nv) => nv.includes("Website"))).toBe(true);
  });

  it("NUNCA deve apresentar a nota como probabilidade estatística de fechamento", () => {
    const result = calculateLeadCompatibilityScore(completeLead);

    // Garante que o texto esclarece que não é garantia ou probabilidade de fechamento
    expect(result.resumoExplicativo).toContain("Não representa probabilidade de fechamento");
    expect(result.resumoExplicativo).not.toMatch(/probabilidade de conversão/i);
  });

  it("NUNCA deve inventar dados não verificados (ex: faturamento ou decisor direto)", () => {
    const result = calculateLeadCompatibilityScore(completeLead);

    expect(result.dadosNaoVerificados.some((nv) => nv.includes("Faturamento"))).toBe(true);
    expect(result.dadosNaoVerificados.some((nv) => nv.includes("Decisor"))).toBe(true);
  });

  it("deve calcular pontuação intermediária para lead com telefone fixo e sem site", () => {
    const mediumLead: Partial<LeadProspeccao> = {
      id: "lead-3",
      nome: "Oficina Mecânica Central",
      telefone: "2733334444",
      cidade: "Vila Velha",
      nicho: "Mecânica",
      total_reviews: 8,
      rating: 4.5,
      endereco: "Rua das Flores, 50",
    };

    const result = calculateLeadCompatibilityScore(mediumLead);

    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(70);
    expect(result.ratingLevel).toBe("media");
    expect(result.dadosUtilizados.some((d) => d.includes("fixo"))).toBe(true);
  });
});
