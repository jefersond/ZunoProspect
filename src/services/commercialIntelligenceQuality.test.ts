import { describe, it, expect } from "vitest";
import {
  buildIntelligentPlan,
  buildStructuredDiagnosis,
  getSdrMessageFromPlan,
  hasExplicitOptOut,
  auditMessageNaturalness,
  extractEmailSubjectAndBody,
  BANNED_ROBOTIC_PATTERNS,
} from "./intelligentSevenDayPlan";
import { generateSdrFirstApproachMessage } from "./sdrProspectingService";

describe("Qualidade da Inteligência Comercial e Plano de 7 Dias", () => {
  // Teste de Banimento Estrito de Frases Clichês
  it("não deve conter nenhum dos 10 clichês comerciais proibidos em nenhum dos 7 dias", () => {
    const lead = {
      nome: "Studio Pilates Harmonia",
      cidade: "Vitória",
      nicho: "estúdio de pilates",
      telefone: "27999881122",
      website: "https://harmoniapilates.com.br",
      total_reviews: 35,
      rating: 4.9,
    };

    const services = [
      "gestao_trafego",
      "social_media",
      "criacao_sites",
      "automacao_crm",
      "geral_b2b",
    ];

    for (const service of services) {
      const plan = buildIntelligentPlan({ lead, userServiceName: service });
      expect(plan.days).toHaveLength(7);

      for (const day of plan.days) {
        const audit = auditMessageNaturalness(day.mensagem);
        expect(
          audit.hasBannedPhrases,
          `Encontrado clichê no Dia ${day.dia} (${service}): ${audit.detected.join(", ")}`
        ).toBe(false);

        // Verifica manualmente contra cada regex dos padrões banidos
        for (const item of BANNED_ROBOTIC_PATTERNS) {
          expect(item.pattern.test(day.mensagem)).toBe(false);
        }
      }

      for (const diag of plan.diagnostico) {
        for (const item of BANNED_ROBOTIC_PATTERNS) {
          expect(item.pattern.test(diag)).toBe(false);
        }
      }
    }
  });

  // Requisito 1, 2, 3 e 4: Diagnóstico Estruturado e Compatibilidade Explicável
  it("deve apresentar hipóteses como possibilidades e nunca inventar probabilidade matemática", () => {
    const lead = {
      nome: "Clínica Sorriso",
      cidade: "Vitória",
      nicho: "odontologia",
      telefone: "27999887766",
      website: "https://clinicasorriso.com.br",
      total_reviews: 42,
      rating: 4.8,
      sinais: {
        has_meta_pixel: false,
        has_gtag: false,
      },
    };

    const structured = buildStructuredDiagnosis(lead, "gestão de tráfego pago");

    // 1. Probabilidade matemática nunca é inventada como percentual
    expect(structured.probabilidade).toBeNull();
    expect(structured.compatibilidade.score).toBeNull();

    // 2. Compatibilidade explicável com critérios observáveis
    expect(structured.compatibilidade.level).toBe("alta");
    expect(structured.compatibilidade.label).toBe("Compatibilidade Alta");
    expect(structured.compatibilidade.criteria).toHaveLength(4);

    // 3. Uma URL cadastrada não prova site ativo
    const urlBullet = structured.diagnostico.find((d) => d.includes("clinicasorriso.com.br"));
    expect(urlBullet).toBeDefined();
    expect(urlBullet).not.toContain("site ativo");
    expect(urlBullet).toContain("requer conferência manual");

    // 4. Ausência de Pixel não é tratada como auditoria completa
    const pixelBullet = structured.diagnostico.find((d) => d.includes("rastreamento"));
    expect(pixelBullet).toBeDefined();
    expect(pixelBullet).toContain("amostragem simples; não substitui auditoria completa");

    // 5. Hipótese comercial apresentada como possibilidade
    const hypothesisBullet = structured.diagnostico.find((d) => d.includes("Possibilidade comercial"));
    expect(hypothesisBullet).toBeDefined();
    expect(hypothesisBullet).toContain("avaliar se a empresa tem interesse");
  });

  // Requisito 2 e 3: Lead sem dados suficientes indica 'Compatibilidade não determinada'
  it("deve indicar 'Compatibilidade não determinada' quando não houver dados suficientes e nunca 85%", () => {
    const incompleteLead = {
      nome: "Comércio Local Sem Dados",
    };

    const structured = buildStructuredDiagnosis(incompleteLead, "gestão de tráfego");

    expect(structured.probabilidade).toBeNull();
    expect(structured.compatibilidade.level).toBe("nao_determinada");
    expect(structured.compatibilidade.label).toBe("Compatibilidade não determinada");
    expect(structured.compatibilidade.description).toContain("Dados públicos insuficientes");
  });

  // Requisito 4: Telefone formatado não é descrito como WhatsApp confirmado
  it("deve indicar que a confirmação de WhatsApp depende do envio e não presumir ativo", () => {
    const lead = {
      nome: "Oficina do Bairro",
      cidade: "Serra",
      nicho: "oficina mecânica",
      telefone: "27988776655",
      website: undefined,
    };

    const structured = buildStructuredDiagnosis(lead, "criação de sites");
    const phoneCriterion = structured.compatibilidade.criteria.find((c) => c.label === "Telefone comercial");
    expect(phoneCriterion).toBeDefined();
    expect(phoneCriterion?.detail).toContain("confirmação de WhatsApp ocorre na primeira abertura");

    const diagPhone = structured.diagnostico.find((d) => d.includes("telefone"));
    expect(diagPhone).toBeDefined();
    expect(diagPhone).toContain("disponibilidade no WhatsApp depende da primeira mensagem");
  });

  // Requisito 5: Preservação de mensagens realmente editadas pelo assinante
  it("deve preservar mensagens marcadas como editadas pelo assinante mesmo ao atualizar cópias", () => {
    const leadWithCustomEdit = {
      nome: "Restaurante Sabor da Ilha",
      cidade: "Vitória",
      nicho: "restaurante",
      telefone: "27999112233",
      plano_prospecao_7dias: [
        {
          dia: 1,
          canal: "whatsapp" as const,
          titulo: "Dia 1",
          mensagem: "MENSAGEM TOTALMENTE PERSONALIZADA PELO ASSINANTE PARA O CHEF ROBERTO.",
          is_custom_edited: true,
          edited_at: "2026-10-25T20:00:00Z",
          acao_sugerida: "Enviar WhatsApp",
          objecao_provavel: "Sem tempo",
          resposta_sugerida: "Compreendo",
          cta: "Podemos conversar?",
        },
        {
          dia: 2,
          canal: "instagram" as const,
          titulo: "Dia 2",
          mensagem: "Mensagem automática antiga sem edição.",
          is_custom_edited: false,
          acao_sugerida: "Direct",
          objecao_provavel: "Sem interesse",
          resposta_sugerida: "Obrigado",
          cta: "Até logo",
        },
      ],
    };

    // Atualiza forçando atualização de cópias antigas
    const updatedPlan = buildIntelligentPlan({
      lead: leadWithCustomEdit,
      userServiceName: "social media para gastronomia",
      existingPlan: leadWithCustomEdit.plano_prospecao_7dias,
      forceUpdateOldCopies: true,
    });

    const day1 = updatedPlan.days.find((d) => d.dia === 1)!;
    const day2 = updatedPlan.days.find((d) => d.dia === 2)!;

    // Dia 1 editado pelo usuário DEVE SER PRESERVADO 100%
    expect(day1.mensagem).toBe("MENSAGEM TOTALMENTE PERSONALIZADA PELO ASSINANTE PARA O CHEF ROBERTO.");
    expect(day1.is_custom_edited).toBe(true);

    // Dia 2 automático é atualizado para o novo padrão humano
    expect(day2.mensagem).toContain("Restaurante Sabor da Ilha");
    expect(day2.mensagem).not.toBe("Mensagem automática antiga sem edição.");
  });

  // Requisito 7: TESTE DE IDENTIDADE ESTRITA ENTRE PLANO E SDR PARA TODOS OS 7 DIAS
  it("TESTE DE IDENTIDADE OBRIGATÓRIO: A mensagem apresentada em cada dia é exatamente a carregada pelo SDR", () => {
    const lead = {
      nome: "Auto Peças Litoral",
      cidade: "Guarapari",
      nicho: "autopeças",
      telefone: "27993334455",
      website: "https://autopecaslitoral.com.br",
      total_reviews: 52,
      rating: 4.8,
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "gestão de tráfego local" });
    lead.plano_prospecao_7dias = plan.days;

    for (let day = 1; day <= 7; day++) {
      const planDay = plan.days.find((d) => d.dia === day)!;
      const sdrFromPlan = getSdrMessageFromPlan(lead, day);
      const sdrFromService = generateSdrFirstApproachMessage({ lead, dayNumber: day });

      // IDENTIDADE ESTRITA: planDay.mensagem === sdrFromPlan.text === sdrFromService.text
      expect(sdrFromPlan.text).toBe(planDay.mensagem);
      expect(sdrFromService.text).toBe(planDay.mensagem);
      expect(sdrFromService.isFromPlan).toBe(true);
      expect(sdrFromService.dayNumber).toBe(day);

      // No Dia 3 (e-mail), o assunto é mantido em campo próprio sem poluir a mensagem
      if (planDay.canal === "email") {
        expect(planDay.assunto_email).toBeDefined();
        expect(sdrFromPlan.assuntoEmail).toBe(planDay.assunto_email);
        expect(planDay.mensagem.startsWith("Assunto:")).toBe(false);
      }
    }
  });

  // Cenário Opt-out: Trava inviolável com mensagem zero
  it("Cenário Opt-out: Opt-out e recusa travam abordagem com mensagem zero", () => {
    const leadWithOptOut = {
      nome: "Loja Exemplo",
      cidade: "Vitória",
      nicho: "varejo",
      status: "recusou_optout",
    };

    expect(hasExplicitOptOut(leadWithOptOut)).toBe(true);

    const plan = buildIntelligentPlan({ lead: leadWithOptOut });
    for (const day of plan.days) {
      expect(day.mensagem).toBe("");
      expect(day.titulo).toContain("Bloqueado por Opt-out");
      expect(day.acao_sugerida).toMatch(/opt-out/i);
    }

    const sdrResult = getSdrMessageFromPlan(leadWithOptOut, 1);
    expect(sdrResult.text).toBe("");
    expect(sdrResult.message).toBe("");
    expect(sdrResult.isOptedOut).toBe(true);
  });
});
