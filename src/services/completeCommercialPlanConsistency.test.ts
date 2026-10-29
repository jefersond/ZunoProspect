import { describe, expect, it } from "vitest";
import { buildIntelligentPlan, auditMessageNaturalness } from "./intelligentSevenDayPlan";
import { buildCommercialContingencies } from "@/utils/commercialContingencies";
import type { LeadProspeccao } from "@/types/lead";
import type { SellerProfile } from "../../supabase/functions/_shared/lead-analysis";

describe("Consistência do Plano Comercial Completo em 6 Serviços Representativos", () => {
  // Cenário 1: Clínica + Automação de WhatsApp
  it("1. Clínica + Automação: cadência coesa focada em triagem e agendamento sem mudar de serviço", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-clinica-auto",
      nome: "Clínica Sorriso Prime",
      nicho: "clínica odontológica",
      cidade: "Vitória",
      foco: "Automação",
      telefone: "27999881122",
    };
    const seller: SellerProfile = {
      display_name: "Rodrigo Silva",
      company_name: "AutoAtende",
      service_category: "automacao",
      service_offered: "Automação de atendimento no WhatsApp para clínicas",
      offer_description: "Implemento triagem rápida, confirmação automática de consultas e redução de faltas de pacientes no WhatsApp.",
      target_audience: "Clínicas odontológicas e médicas",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "Automação" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "Automação" });

    // Diagnóstico fundamentado
    expect(plan.companyName).toBe("Clínica Sorriso Prime");
    expect(plan.diagnostico.some((b) => b.toLowerCase().includes("atendimento") || b.toLowerCase().includes("contato"))).toBe(true);

    // Primeira abordagem e follow-ups
    const sendableDays = plan.days.filter((d) => d.mensagem && d.mensagem.trim().length > 0);
    expect(sendableDays.length).toBeGreaterThanOrEqual(1);

    for (const d of sendableDays) {
      const audit = auditMessageNaturalness(d.mensagem);
      expect(audit.isNatural).toBe(true);
      expect(audit.hasBannedPhrases).toBe(false);
      // Não deve prometer entrega de tráfego pago ou site
      expect(d.mensagem.toLowerCase()).not.toMatch(/gestão de tráfego|crio seu site|anúncios no google/i);
    }

    // Follow-ups não são repetições idênticas do Dia 1
    const day1Msg = plan.days.find((d) => d.dia === 1)?.mensagem;
    const day4Msg = plan.days.find((d) => d.dia === 4)?.mensagem;
    if (day1Msg && day4Msg) {
      expect(day1Msg).not.toEqual(day4Msg);
    }

    // Contingências geradas para os 7 cenários
    expect(contingencies.items).toHaveLength(7);
    expect(contingencies.items.find((i) => i.id === "interesse")?.respostaSugerida).toContain("Clínica Sorriso Prime");
  });

  // Cenário 2: Clínica + Tráfego Pago
  it("2. Clínica + Tráfego Pago: foco em demanda de pacientes locais sem promessas absurdas", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-clinica-trafego",
      nome: "Instituto Dermato Vitória",
      nicho: "clínica de dermatologia",
      cidade: "Vitória",
      foco: "Tráfego",
      telefone: "27999882233",
    };
    const seller: SellerProfile = {
      display_name: "Marina Costa",
      company_name: "Costa Mídia",
      service_category: "trafego",
      service_offered: "Gestão de tráfego pago no Google para clínicas",
      offer_description: "Faço anúncios no Google para pessoas que já estão buscando procedimentos na cidade.",
      target_audience: "Clínicas médicas e estéticas",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "Tráfego" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "Tráfego" });

    // Mensagens focam em demanda de busca local
    const day1 = plan.days.find((d) => d.dia === 1)!;
    expect(day1.mensagem).toContain("Instituto Dermato Vitória");
    expect(day1.mensagem.toLowerCase()).toMatch(/tráfego|anúncios|pesquis/);
    expect(day1.mensagem.toLowerCase()).not.toMatch(/dobrar faturamento|garantia de clientes/);

    expect(contingencies.items.find((i) => i.id === "ja_possui_fornecedor")?.respostaSugerida).toContain("dermatologia");
  });

  // Cenário 3: Restaurante + Social Media
  it("3. Restaurante + Social Media: foco em apresentação de cardápio e visual sem intimidade falsa", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-restaurante",
      nome: "Burguer Artesanal do Chefe",
      nicho: "hamburgueria artesanal",
      cidade: "Vila Velha",
      foco: "Social",
      instagram_url: "https://instagram.com/burguerchefe",
    };
    const seller: SellerProfile = {
      display_name: "Lucas Design",
      company_name: "Lucas Social",
      service_category: "social_media",
      service_offered: "Gestão de Instagram e fotos para restaurantes",
      offer_description: "Fotografo pratos e organizo o Instagram para ser uma vitrine de pedidos diretos.",
      target_audience: "Restaurantes e hamburguerias",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "Social" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "Social" });

    // Jamais dizer "acompanho vocês há muito tempo"
    for (const d of plan.days) {
      if (d.mensagem) {
        expect(d.mensagem.toLowerCase()).not.toMatch(/acompanho vocês há muito tempo|sou cliente assíduo/);
      }
    }

    expect(contingencies.items.find((i) => i.id === "mais_informacoes")?.respostaSugerida).toContain("hamburgueria artesanal");
  });

  // Cenário 4: Empresa Industrial + CRM
  it("4. Empresa Industrial + CRM: foco em canal ativo B2B sem jargões de telemarketing", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-industria",
      nome: "Metálica Estruturas",
      nicho: "estruturas metálicas industriais",
      cidade: "Serra",
      foco: "CRM",
      telefone: "2733221100",
    };
    const seller: SellerProfile = {
      display_name: "Fabio Consultoria",
      company_name: "Foco B2B",
      service_category: "crm",
      service_offered: "Organização comercial e CRM para empresas industriais",
      offer_description: "Estruturo rotina de acompanhamento de orçamentos e captação ativa B2B.",
      target_audience: "Indústrias e distribuidoras",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "CRM" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "CRM" });

    const day1 = plan.days.find((d) => d.dia === 1)!;
    expect(day1.mensagem).toContain("Metálica Estruturas");
    // Tom respeitoso e corporativo B2B
    expect(day1.mensagem.toLowerCase()).not.toMatch(/super oportunidade|imperdível/);

    expect(contingencies.items.find((i) => i.id === "contato_nao_e_responsavel")?.respostaSugerida).toContain("Metálica Estruturas");
  });

  // Cenário 5: Comércio + Site
  it("5. Comércio + Criação de Site: página leve com catálogo e facilidade de contato", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-comercio",
      nome: "Móveis & Design Vitória",
      nicho: "loja de móveis planejados",
      cidade: "Vitória",
      foco: "Sites/Landing",
    };
    const seller: SellerProfile = {
      display_name: "Camila Web",
      company_name: "Camila Sites",
      service_category: "sites",
      service_offered: "Criação de sites e catálogos para lojas locais",
      offer_description: "Crio páginas rápidas com catálogo, localização, horário e botão direto para o WhatsApp da loja.",
      target_audience: "Lojas e comércio local",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "Sites/Landing" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "Sites/Landing" });

    const day1 = plan.days.find((d) => d.dia === 1)!;
    expect(day1.mensagem).toContain("Móveis & Design Vitória");

    expect(contingencies.items.find((i) => i.id === "nao_e_o_momento")?.respostaSugerida).toContain("móveis planejados");
  });

  // Cenário 6: Prestador Local + Captação de Clientes
  it("6. Prestador Local + Captação: validação neutra sem alucinar problemas internos", () => {
    const lead: Partial<LeadProspeccao> = {
      id: "lead-prestador",
      nome: "Mecânica Auto Center Express",
      nicho: "oficina mecânica",
      cidade: "Cariacica",
      foco: "Full Service",
      telefone: "27998877665",
    };
    const seller: SellerProfile = {
      display_name: "Eduardo Santos",
      company_name: "Santos Consultoria",
      service_category: "full_service",
      service_offered: "Captação de clientes locais para oficinas e serviços",
      offer_description: "Ajudo oficinas mecânicas a receberem contatos semanais de motoristas da região que precisam de manutenção.",
      target_audience: "Oficinas mecânicas e autocenters",
    };

    const plan = buildIntelligentPlan({ lead, userServiceName: "Full Service" });
    const contingencies = buildCommercialContingencies({ lead, sellerProfile: seller, foco: "Full Service" });

    // Não deve afirmar que a oficina tem problemas de atendimento nem inventar auditoria
    for (const d of plan.days) {
      if (d.mensagem) {
        expect(d.mensagem.toLowerCase()).not.toMatch(/seu atendimento é ruim|já analisei seu marketing/);
      }
    }

    expect(contingencies.items.find((i) => i.id === "pediu_para_parar")?.respostaSugerida).toContain("Cariacica");
  });
});
