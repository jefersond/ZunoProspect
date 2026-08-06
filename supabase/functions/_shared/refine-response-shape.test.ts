import { describe, expect, it } from "vitest";
import { buildRefinePlanResponse, type RefinePlanAnalise, type RefinePlanInputContext } from "./refine-response-shape.ts";

interface RefinePlanResponseShape {
  input_context: RefinePlanInputContext;
  diagnostico: { fit: string; dor_provavel: string; urgencia: string; oportunidade: string; justificativa: string };
  copies: Record<string, string>;
  abordagens_por_canal: { whatsapp: string; instagram: string; email: string };
  plano_prospeccao_7dias: Array<{ dia: number; cta?: string }>;
  debug: { fallback_used: boolean; missing_fields: string[] };
}

// Teste de regressão de qualidade: garante que a correção de estabilidade não removeu
// nenhuma das 7 seções que o usuário precisa para abordar o lead (ver REGRA CRÍTICA DE
// QUALIDADE do incidente). Compara a MESMA análise de entrada e verifica a saída completa.
const inputContext: RefinePlanInputContext = {
  empresa: "Clínica Sorriso Feliz",
  nicho: "odontologia",
  cidade: "Belo Horizonte",
  estado: "Av. Afonso Pena, 1000",
  site: "https://clinicasorrisofeliz.com.br",
  oferta_usuario: "avaliação gratuita",
  publico_alvo: "pacientes locais",
  dor_principal: "poucos agendamentos recorrentes",
  objetivo: "aumentar agendamentos",
  canal: "whatsapp",
  etapa: "prospeccao",
};

function buildFullAnalise(): RefinePlanAnalise {
  return {
    fit_level: "alto",
    probable_pain: "Baixa recorrência de pacientes por falta de acompanhamento pós-consulta.",
    commercial_opportunity: "Estruturar uma rotina de reativação de pacientes antigos via WhatsApp.",
    why_good_lead: "Site ativo, Instagram com bom engajamento e nenhuma automação de retorno hoje.",
    diagnostico_bullets: [
      "A clínica tem site e Instagram ativos, mas não usa WhatsApp Business para reagendar pacientes antigos.",
      "Não há Meta Pixel nem Google Analytics instalados, então não é possível medir a origem dos agendamentos.",
      "O perfil no Instagram tem engajamento consistente, o que indica presença de público local qualificado.",
    ],
    messages: {
      whatsapp_primary: "Olá! Vi que a Clínica Sorriso Feliz atende em Belo Horizonte...",
      instagram: "Oi! Curti o perfil de vocês, posso fazer uma pergunta rápida?",
      email_body: "Prezados, gostaria de apresentar uma ideia para reativação de pacientes.",
    },
    plano_prospeccao_7dias: Array.from({ length: 7 }, (_, index) => ({
      dia: index + 1,
      canal: index % 2 === 0 ? "whatsapp" : "instagram",
      acao_sugerida: `Ação específica do dia ${index + 1}`,
      mensagem: `Mensagem personalizada e única do dia ${index + 1} para a Clínica Sorriso Feliz.`,
      objecao_provavel: "Já temos um jeito de agendar retorno.",
      resposta_sugerida: "Entendo, a ideia é só complementar o que já funciona.",
      cta: `Próximo passo sugerido do dia ${index + 1}: você tem 5 minutos essa semana?`,
    })),
  };
}

describe("buildRefinePlanResponse — quality regression (7 required sections)", () => {
  const response = buildRefinePlanResponse({
    leadId: "lead-123",
    requestId: "req-123",
    analise: buildFullAnalise(),
    inputContext,
    fallbackUsed: false,
    missingFields: [],
  }) as unknown as RefinePlanResponseShape;

  it("1. preserves the business summary (resumo do negócio)", () => {
    expect(response.input_context).toMatchObject({
      empresa: "Clínica Sorriso Feliz",
      nicho: "odontologia",
      cidade: "Belo Horizonte",
    });
  });

  it("2. preserves the strategic diagnosis (diagnóstico)", () => {
    expect(response.diagnostico.dor_provavel).toContain("Baixa recorrência");
    expect(response.diagnostico.justificativa).toContain("Site ativo");
  });

  it("3. preserves the identified opportunity (oportunidades)", () => {
    expect(response.diagnostico.oportunidade).toContain("reativação de pacientes");
  });

  it("4. preserves the full 7-day prospecting plan (Plano de Prospecção)", () => {
    expect(response.plano_prospeccao_7dias).toHaveLength(7);
    const days = response.plano_prospeccao_7dias.map((d: { dia: number }) => d.dia);
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("5. preserves per-day approach arguments (argumentos de abordagem)", () => {
    for (let day = 1; day <= 7; day += 1) {
      expect(response.copies[`dia_${day}`]).toContain(`dia ${day}`);
    }
  });

  it("6. preserves personalized messages per channel (mensagens personalizadas)", () => {
    expect(response.abordagens_por_canal.whatsapp).toContain("Clínica Sorriso Feliz");
    expect(response.abordagens_por_canal.instagram).toContain("Curti o perfil");
    expect(response.abordagens_por_canal.email).toContain("reativação");
  });

  it("7. preserves recommended next steps for every day (próximos passos recomendados)", () => {
    for (const day of response.plano_prospeccao_7dias) {
      expect(day.cta).toMatch(/Próximo passo sugerido/);
    }
  });

  it("never silently drops a section when the AI response used the quality fallback", () => {
    const fallbackResponse = buildRefinePlanResponse({
      leadId: "lead-123",
      requestId: "req-123",
      analise: buildFullAnalise(),
      inputContext,
      fallbackUsed: true,
      missingFields: ["plano_prospeccao_7dias"],
    }) as unknown as RefinePlanResponseShape;
    expect(fallbackResponse.plano_prospeccao_7dias).toHaveLength(7);
    expect(fallbackResponse.debug.fallback_used).toBe(true);
    expect(fallbackResponse.debug.missing_fields).toEqual(["plano_prospeccao_7dias"]);
  });
});
