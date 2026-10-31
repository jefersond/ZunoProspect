import { describe, it, expect } from "vitest";
import {
  isOfferSufficientlyDetailed,
  getOfferClarificationQuestion,
  buildExploratoryOfferDescription,
} from "./offerClarification";
import type { SellerProfile } from "@/lib/sellerProfile";

describe("offerClarification", () => {
  const baseProfile: SellerProfile = {
    display_name: "Rodrigo Silva",
    company_name: "AutoAtende",
    service_category: "automacao",
    service_offered: "Automação de WhatsApp",
    offer_description: "Implantamos triagem e agendamento automático no WhatsApp para clínicas odontológicas.",
    target_audience: "Clínicas odontológicas",
    commercial_maturity: "equilibrado",
  };

  describe("isOfferSufficientlyDetailed", () => {
    it("deve retornar false quando o perfil for nulo ou indefinido", () => {
      expect(isOfferSufficientlyDetailed(null)).toBe(false);
      expect(isOfferSufficientlyDetailed(undefined)).toBe(false);
    });

    it("deve retornar false quando faltar o nome do vendedor", () => {
      expect(isOfferSufficientlyDetailed({ ...baseProfile, display_name: "" })).toBe(false);
    });

    it("deve retornar false quando faltar o serviço oferecido", () => {
      expect(isOfferSufficientlyDetailed({ ...baseProfile, service_offered: "", service_category: "" })).toBe(false);
    });

    it("deve retornar false quando a descrição da oferta for muito curta (< 30 caracteres)", () => {
      expect(isOfferSufficientlyDetailed({ ...baseProfile, offer_description: "Automação rápida" })).toBe(false);
      expect(isOfferSufficientlyDetailed({ ...baseProfile, offer_description: "" })).toBe(false);
    });

    it("deve retornar true quando nome, serviço e descrição detalhada (>= 30 caracteres) estiverem preenchidos", () => {
      expect(isOfferSufficientlyDetailed(baseProfile)).toBe(true);
    });
  });

  describe("getOfferClarificationQuestion", () => {
    it("deve gerar pergunta determinística contextualizada para Automação de WhatsApp", () => {
      const q = getOfferClarificationQuestion({
        ...baseProfile,
        service_offered: "Automação de WhatsApp",
        offer_description: "",
      });

      expect(q.isDetailed).toBe(false);
      expect(q.contextService).toBe("Automação de WhatsApp");
      expect(q.question).toBe("Qual problema sua automação resolve para o tipo de empresa que você quer atender?");
      expect(q.placeholder).toContain("Triagem automática");
    });

    it("deve gerar pergunta contextualizada para Tráfego Pago", () => {
      const q = getOfferClarificationQuestion({
        ...baseProfile,
        service_offered: "Gestão de Tráfego Pago",
        offer_description: "",
      });

      expect(q.question).toBe("Qual é o foco principal da sua gestão de tráfego para os clientes que você quer atender?");
      expect(q.placeholder).toContain("Geração de novos contatos qualificados");
    });

    it("deve gerar pergunta contextualizada para Sites e Landing Pages", () => {
      const q = getOfferClarificationQuestion({
        ...baseProfile,
        service_offered: "Desenvolvimento de Landing Pages",
        offer_description: "",
      });

      expect(q.question).toBe("Qual é o principal objetivo dos sites ou páginas que você desenvolve para seus clientes?");
    });

    it("deve gerar pergunta contextualizada para CRM", () => {
      const q = getOfferClarificationQuestion({
        ...baseProfile,
        service_offered: "Implantação de CRM",
        offer_description: "",
      });

      expect(q.question).toBe("Qual gargalo comercial ou de atendimento seu projeto de CRM ajuda a resolver?");
    });

    it("deve gerar pergunta contextualizada para Social Media", () => {
      const q = getOfferClarificationQuestion({
        ...baseProfile,
        service_offered: "Social Media e Instagram",
        offer_description: "",
      });

      expect(q.question).toBe("Qual transformação principal você entrega na gestão de redes sociais para empresas?");
    });

    it("deve contextualizar o placeholder com o nicho do lead quando informado", () => {
      const q = getOfferClarificationQuestion(
        {
          ...baseProfile,
          service_offered: "Automação de WhatsApp",
          offer_description: "",
        },
        "Clínica Odontológica"
      );

      expect(q.placeholder).toContain("Clínica Odontológica");
    });
  });

  describe("buildExploratoryOfferDescription", () => {
    it("deve gerar texto com >= 30 caracteres sem inventar promessas ou métricas falsas", () => {
      const desc = buildExploratoryOfferDescription("Automação de WhatsApp");

      expect(desc.length).toBeGreaterThanOrEqual(30);
      expect(desc).toContain("Automação de WhatsApp");
      expect(desc).toContain("abordagem consultiva e exploratória");
      expect(desc).toContain("sem promessas prévias");
    });

    it("deve funcionar mesmo com nome de serviço vazio", () => {
      const desc = buildExploratoryOfferDescription("");

      expect(desc.length).toBeGreaterThanOrEqual(30);
      expect(desc).toContain("serviços profissionais");
    });
  });
});
