import { describe, it, expect } from "vitest";
import {
  buildIntelligentPlan,
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

  // Cenário A: Tráfego + Dentista (Clínica Sorriso, Vitória)
  it("Cenário A: Tráfego + Dentista respeita sinais reais e foca em atração local", () => {
    const lead = {
      nome: "Clínica OdontoVix",
      cidade: "Vitória",
      nicho: "clínica odontológica",
      telefone: "27998887766",
      website: "https://odontovix.com.br",
      total_reviews: 48,
      rating: 4.8,
      sinais: {
        has_meta_pixel: false,
        has_gtag: false,
      },
    };

    const plan = buildIntelligentPlan({
      lead,
      userServiceName: "gestão de tráfego pago para dentistas",
    });

    expect(plan.days).toHaveLength(7);
    const day1 = plan.days[0];
    expect(day1.canal).toBe("whatsapp");
    expect(day1.mensagem).toContain("Clínica OdontoVix");
    expect(day1.mensagem).toContain("Vitória");
    // Não inventa pixel nem faz falsas promessas
    expect(day1.mensagem).not.toContain("pixel instalado");
    expect(day1.mensagem).not.toContain("garantia de pacientes");
    expect(day1.mensagem).not.toContain("vídeo de 1 minuto");

    // Diagnóstico responde às perguntas reais
    expect(plan.diagnostico.some((d) => d.includes("Vitória"))).toBe(true);
    expect(plan.diagnostico.some((d) => d.includes("48 avaliações"))).toBe(true);
  });

  // Cenário B: Social Media + Restaurante (Cantina do Porto, Vila Velha)
  it("Cenário B: Social Media + Restaurante foca em presença visual e rotina gastronômica", () => {
    const lead = {
      nome: "Cantina do Porto",
      cidade: "Vila Velha",
      nicho: "restaurante italiano",
      telefone: "27991112233",
      instagram_url: "https://instagram.com/cantinadoporto",
      total_reviews: 120,
      rating: 4.7,
    };

    const plan = buildIntelligentPlan({
      lead,
      userServiceName: "social media para gastronomia",
    });

    const day1 = plan.days[0];
    expect(day1.mensagem).toContain("Cantina do Porto");
    expect(day1.mensagem).toContain("Vila Velha");
    expect(day1.mensagem.toLowerCase()).toMatch(/social media|presença|conteúdo|visual/);
  });

  // Cenário C: Criação de Sites + Sem Site (Mecânica Central, Serra)
  it("Cenário C: Criação de Sites + Sem Site não afirma que encontrou o site", () => {
    const lead = {
      nome: "Mecânica Central",
      cidade: "Serra",
      nicho: "oficina mecânica",
      telefone: "27988880000",
      website: undefined, // Sem site!
      total_reviews: 14,
      rating: 4.5,
    };

    const plan = buildIntelligentPlan({
      lead,
      userServiceName: "criação de sites e landing pages",
    });

    for (const day of plan.days) {
      expect(day.mensagem).not.toContain("Encontrei o site de vocês");
      expect(day.mensagem).not.toContain("Vi no site de vocês");
      expect(day.mensagem).not.toContain("Seu site atual");
    }

    // Deve diagnosticar ausência de página institucional
    expect(plan.diagnostico.some((d) => d.toLowerCase().includes("sem site") || d.toLowerCase().includes("site"))).toBe(true);
  });

  // Cenário D: Automação / Agência + Comércio Local (Padaria Pão Nobre, Cariacica)
  it("Cenário D: Automação CRM foca em tempo de resposta e atendimento ágil", () => {
    const lead = {
      nome: "Padaria Pão Nobre",
      cidade: "Cariacica",
      nicho: "padaria e confeitaria",
      telefone: "27977778899",
      total_reviews: 80,
      rating: 4.6,
    };

    const plan = buildIntelligentPlan({
      lead,
      userServiceName: "automação de atendimento no WhatsApp e CRM",
    });

    expect(plan.days[0].mensagem).toContain("Padaria Pão Nobre");
    expect(plan.days[0].mensagem.toLowerCase()).toMatch(/atendimento|resposta|whatsapp/);
  });

  // Cenário E: Empresa Respondeu -> Plano adapta e não manda mensagem fria
  it("Cenário E: Empresa que respondeu entra em modo de diálogo consultivo", () => {
    const lead = {
      nome: "Marmoraria Granitos",
      cidade: "Linhares",
      nicho: "marmoraria",
      status: "respondeu",
      notas: "status: respondeu - Perguntou valor",
    };

    const plan = buildIntelligentPlan({ lead });
    expect(plan.days[0].titulo).toContain("Resposta Consultiva");
    expect(plan.days[0].mensagem).toContain("Marmoraria Granitos");
    expect(plan.days[0].mensagem).toContain("Obrigado pelo retorno");
    expect(plan.days[0].acao_sugerida).toContain("Responder à mensagem da empresa");
  });

  // Cenário F: Reunião Marcada -> Plano congela abordagem fria e foca na reunião
  it("Cenário F: Reunião marcada foca em preparação e confirmação", () => {
    const lead = {
      nome: "Contabilidade Express",
      cidade: "Colatina",
      nicho: "escritório de contabilidade",
      status: "reuniao_marcada",
      notas: "status: reuniao_marcada - Agendado para quinta 15h",
    };

    const plan = buildIntelligentPlan({ lead });
    const day = plan.days[0];
    expect(day.titulo).toContain("Confirmação e Preparação da Reunião");
    expect(day.mensagem).toContain("Confirmando nossa conversa");
    expect(day.acao_sugerida).toContain("Enviar confirmação de horário no WhatsApp");
  });

  // Cenário G: Opt-out / Recusa -> Trava inviolável
  it("Cenário G: Opt-out e recusa travam abordagem imediatamente com mensagem zero", () => {
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

  // TESTE OBRIGATÓRIO DE IDENTIDADE:
  // "mensagem do Dia X no plano === mensagem inicialmente carregada pelo SDR no Dia X"
  it("TESTE DE IDENTIDADE OBRIGATÓRIO: SDR carrega exatamente a mensagem do Dia X do plano", () => {
    const lead = {
      nome: "Auto Peças Litoral",
      cidade: "Guarapari",
      nicho: "autopeças",
      telefone: "27993334455",
      website: "https://autopecaslitoral.com.br",
      total_reviews: 52,
      rating: 4.8,
    };

    // Gera o plano de 7 dias
    const plan = buildIntelligentPlan({ lead, userServiceName: "gestão de tráfego local" });
    lead.plano_prospecao_7dias = plan.days;

    // Para cada dia de 1 a 7, valida que o SDR recupera exatamente a mesma mensagem do plano
    for (let day = 1; day <= 7; day++) {
      const planDay = plan.days.find((d) => d.dia === day)!;
      const sdrFromPlan = getSdrMessageFromPlan(lead, day);
      const sdrFromService = generateSdrFirstApproachMessage({ lead, dayNumber: day });

      // IDENTIDADE ESTRITA ENTRE SDR E PLANO
      expect(sdrFromPlan.text).toBe(sdrFromService.text);
      expect(sdrFromService.isFromPlan).toBe(true);
      expect(sdrFromService.dayNumber).toBe(day);

      if (planDay.canal === "email" && planDay.mensagem.startsWith("Assunto:")) {
        // E-mail tem Assunto isolado em campo próprio para o cliente de e-mail
        expect(planDay.mensagem).toContain(sdrFromPlan.text);
        expect(sdrFromPlan.assuntoEmail.length).toBeGreaterThan(5);
      } else {
        expect(sdrFromPlan.text).toBe(planDay.mensagem);
      }
    }
  });

  // Teste de Separação de Assunto e Corpo de E-mail
  it("deve separar Assunto e Corpo em mensagens de e-mail sem colocar Assunto no WhatsApp", () => {
    const rawEmailMessage = "Assunto: Observação prática sobre clientes em Vitória\n\nOlá, Dr. Roberto!\n\nVi a atuação da sua clínica e preparei uma sugestão.";

    const extracted = extractEmailSubjectAndBody(rawEmailMessage);
    expect(extracted.subject).toBe("Observação prática sobre clientes em Vitória");
    expect(extracted.body).toBe("Olá, Dr. Roberto!\n\nVi a atuação da sua clínica e preparei uma sugestão.");

    // Se for mensagem normal sem tag de assunto, usa o fallback fornecido
    const plainMessage = "Oi, equipe da Clínica Sorriso! Tudo bem?";
    const extractedPlain = extractEmailSubjectAndBody(plainMessage, "Contato com Dr. Roberto / Clínica Sorriso");
    expect(extractedPlain.subject).toBe("Contato com Dr. Roberto / Clínica Sorriso");
    expect(extractedPlain.body).toBe("Oi, equipe da Clínica Sorriso! Tudo bem?");
  });
});
