import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionMock, rpcMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    rpc: rpcMock,
    from: fromMock,
  },
}));

import {
  sanitizeBrazilianPhoneNumber,
  generateSdrFirstApproachMessage,
  updateSdrProspectingStatus,
} from "./sdrProspectingService";

describe("sdrProspectingService - Regras Comerciais e Sanitização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("deve sanitizar números brasileiros com 11 dígitos (celular) e adicionar DDI 55", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
    expect(res.formattedDisplay).toBe("(27) 99999-8888");
  });

  it("deve sanitizar números que já possuem 55 sem duplicar o prefixo", () => {
    const res = sanitizeBrazilianPhoneNumber("+55 27 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
  });

  it("deve reconhecer telefones fixos de 10 dígitos (sem marcar como celular)", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 3322-1100");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(false);
    expect(res.cleanNumber).toBe("552733221100");
  });

  it("deve retornar vazio para números inválidos ou nulos", () => {
    const res1 = sanitizeBrazilianPhoneNumber(null);
    expect(res1.isValid).toBe(false);
    expect(res1.cleanNumber).toBe("");

    const res2 = sanitizeBrazilianPhoneNumber("123");
    expect(res2.isValid).toBe(false);
    expect(res2.cleanNumber).toBe("");
  });

  it("deve gerar mensagem consultiva usando dados reais da empresa sem inventar fatos", () => {
    const lead = {
      nome: "Clínica Sorriso",
      cidade: "Vila Velha",
      nicho: "clínica odontológica",
      telefone: "(27) 99888-7766",
      website: "https://sorriso.com.br",
      rating: 4.9,
      total_reviews: 24,
      sinais: {
        has_whatsapp_on_site: true,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
    };

    const result = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "gestão de tráfego",
      style: "consultivo",
    });

    expect(result.text).toContain("Oi, Clínica Sorriso!");
    expect(result.text).toContain("Vila Velha");
    expect(result.text).toContain("4.9 estrelas em 24 avaliações");
    expect(result.text).toContain("gestão de tráfego");
    expect(result.whatsappUrl).toContain("https://wa.me/5527998887766");
    expect(result.whatsappUrl).toContain(encodeURIComponent("Oi, Clínica Sorriso!"));
  });

  it("NÃO deve inventar avaliações ou site se a empresa não possuir", () => {
    const leadSemSiteOuReviews = {
      nome: "Boutique Bella",
      cidade: "Vitória",
      nicho: "moda feminina",
      telefone: "27991112233",
      website: null,
      rating: null,
      total_reviews: 0,
      sinais: {
        has_whatsapp_on_site: false,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
      },
    };

    const result = generateSdrFirstApproachMessage({
      lead: leadSemSiteOuReviews,
      userServiceName: "criação de catálogo e anúncios",
      style: "consultivo",
    });

    // Não deve inventar avaliações inexistentes
    expect(result.text).not.toContain("estrelas em");
    expect(result.text).not.toContain("Encontrei o site");
    expect(result.text).toContain("Oi, Boutique Bella!");
    expect(result.text).toContain("Vitória");
  });

  it("deve gerar estilo direto objetivo sem promessas agressivas", () => {
    const lead = {
      nome: "Advocacia Silva",
      cidade: "Serra",
      nicho: "escritório de advocacia",
      telefone: "27992223344",
      website: "https://advsilva.com.br",
    };

    const result = generateSdrFirstApproachMessage({
      lead,
      userServiceName: "captação de clientes locais",
      style: "direto",
    });

    expect(result.text).toContain("Oi, Advocacia Silva! Tudo bem?");
    expect(result.text).toContain("Quem é a pessoa responsável pelo comercial ou marketing");
    expect(result.text).toContain("compartilhar uma observação rápida");
    expect(result.text).not.toContain("1 minuto");
  });

  it("deve usar o plano de 7 dias como fonte única de verdade quando existente", () => {
    const lead = {
      nome: "Clínica Sorriso",
      cidade: "Vitória",
      nicho: "odontologia",
      telefone: "27999887766",
      plano_prospecao_7dias: [
        {
          dia: 1,
          canal: "whatsapp" as const,
          titulo: "Abordagem Inicial",
          mensagem: "Olá Dr. Roberto! Vi a Clínica Sorriso em Vitória e preparei este contato específico.",
          objetivo: "Abertura",
          acao_sugerida: "Enviar no WhatsApp",
          objecao_provavel: "Sem tempo",
          resposta_sugerida: "Compreendo a rotina",
          cta: "Podemos conversar amanhã?"
        },
        {
          dia: 3,
          canal: "email" as const,
          titulo: "Follow-up Educativo",
          mensagem: "Assunto: Observação sobre captação em Vitória\n\nOi equipe da Clínica Sorriso, complementando nossa mensagem anterior...",
          objetivo: "Follow-up",
          acao_sugerida: "Enviar por e-mail",
          objecao_provavel: "Já temos agência",
          resposta_sugerida: "Ótimo ponto",
          cta: "Qual o melhor e-mail?"
        }
      ]
    };

    const sdrDia1 = generateSdrFirstApproachMessage({
      lead,
      dayNumber: 1
    });

    expect(sdrDia1.isFromPlan).toBe(true);
    expect(sdrDia1.text).toBe("Olá Dr. Roberto! Vi a Clínica Sorriso em Vitória e preparei este contato específico.");

    const sdrDia3 = generateSdrFirstApproachMessage({
      lead,
      dayNumber: 3
    });

    expect(sdrDia3.isFromPlan).toBe(true);
    expect(sdrDia3.text).toBe("Oi equipe da Clínica Sorriso, complementando nossa mensagem anterior...");
  });

  it("deve bloquear updateSdrProspectingStatus quando usuário não estiver autenticado", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const res = await updateSdrProspectingStatus({
      leadId: "mock-lead-123",
      status: "contato_realizado",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("não autenticado");
  });

  it("deve bloquear updateSdrProspectingStatus quando RPC is_admin retornar false (assinante comum)", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: "user-subscriber-uuid",
            email: "assinante@empresa.com",
            app_metadata: { role: "authenticated" },
          },
        },
      },
      error: null,
    });

    rpcMock.mockResolvedValueOnce({
      data: false,
      error: null,
    });

    const res = await updateSdrProspectingStatus({
      leadId: "mock-lead-123",
      status: "contato_realizado",
    });

    expect(rpcMock).toHaveBeenCalledWith("is_admin", { _user_id: "user-subscriber-uuid" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Acesso restrito: operações do fluxo SDR estão em fase de testes e restritas exclusivamente a administradores.");
  });

  it("deve bloquear updateSdrProspectingStatus quando RPC is_admin falhar com erro", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: "user-subscriber-uuid",
            email: "assinante@empresa.com",
          },
        },
      },
      error: null,
    });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "database error" },
    });

    const res = await updateSdrProspectingStatus({
      leadId: "mock-lead-123",
      status: "contato_realizado",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Acesso restrito");
  });

  it("deve permitir updateSdrProspectingStatus quando RPC is_admin retornar true (administrador)", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: "admin-user-uuid",
            email: "jeferson.zanotell@gmail.com",
          },
        },
      },
      error: null,
    });

    rpcMock.mockResolvedValueOnce({
      data: true,
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: { notas: "Nota anterior existente" },
      error: null,
    });
    const selectEq2Mock = vi.fn().mockReturnValue({ single: singleMock });
    const selectEq1Mock = vi.fn().mockReturnValue({ eq: selectEq2Mock });
    const selectMock = vi.fn().mockReturnValue({ eq: selectEq1Mock });

    const updateEq2Mock = vi.fn().mockResolvedValue({ error: null });
    const updateEq1Mock = vi.fn().mockReturnValue({ eq: updateEq2Mock });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEq1Mock });

    fromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: selectMock,
          update: updateMock,
        };
      }
      return {};
    });

    const res = await updateSdrProspectingStatus({
      leadId: "mock-lead-123",
      status: "contato_realizado",
      notes: "Abordagem inicial enviada",
    });

    expect(rpcMock).toHaveBeenCalledWith("is_admin", { _user_id: "admin-user-uuid" });
    expect(res.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "em_contato",
        notas: expect.stringContaining("[SDR WhatsApp - "),
      })
    );
  });

  it("não deve chamar nenhuma API externa ou Gemini ao gerar mensagem do SDR", () => {
    const lead = {
      nome: "Empresa Teste",
      cidade: "Vitória",
      nicho: "varejo",
      telefone: "27999887766",
      plano_prospecao_7dias: [
        {
          dia: 1,
          canal: "whatsapp" as const,
          titulo: "Abordagem Inicial",
          mensagem: "Mensagem exata salva no plano de 7 dias sem recálculo.",
          objetivo: "Abertura",
          acao_sugerida: "Enviar no WhatsApp",
          objecao_provavel: "Sem tempo",
          resposta_sugerida: "Compreendo a rotina",
          cta: "Podemos conversar?"
        }
      ]
    };

    const sdrMsg = generateSdrFirstApproachMessage({
      lead,
      dayNumber: 1
    });

    // Garante que o texto vem estritamente do plano salvo sem chamar IA
    expect(sdrMsg.text).toBe("Mensagem exata salva no plano de 7 dias sem recálculo.");
    expect(sdrMsg.whatsappUrl).toBe("https://wa.me/5527999887766?text=Mensagem%20exata%20salva%20no%20plano%20de%207%20dias%20sem%20rec%C3%A1lculo.");
    expect(sdrMsg.targetPhone).toBe("5527999887766");
  });
});
