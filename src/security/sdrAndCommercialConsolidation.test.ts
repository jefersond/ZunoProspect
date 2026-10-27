import { describe, it, expect, vi, beforeEach } from "vitest";

// ==============================================================================
// TESTES DE CONSOLIDAÇÃO: SEGURANÇA DO SDR, CRM E PERFIL COMERCIAL (PR #65)
// ==============================================================================

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
  updateSdrProspectingStatus,
  generateSdrFirstApproachMessage,
  sanitizeBrazilianPhoneNumber,
} from "@/services/sdrProspectingService";
import { hasExplicitOptOut } from "@/services/intelligentSevenDayPlan";
import {
  evaluatePreconditions,
  sanitizeSellerProfile,
  isSellerProfileComplete,
  type SellerProfile,
} from "../../supabase/functions/_shared/lead-analysis";
import { loadSellerProfileForUser } from "../../supabase/functions/_shared/seller-profile-store";

describe("Consolidação PR #65 - Segurança do SDR, CRM e Perfil Comercial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. USUÁRIO COMUM TENTANDO ACESSAR OU EXECUTAR OPERAÇÕES DO SDR
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. Bloqueio de Usuário Comum no SDR", () => {
    it("deve rejeitar updateSdrProspectingStatus se não houver usuário autenticado", async () => {
      getSessionMock.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const res = await updateSdrProspectingStatus({
        leadId: "lead-anon-1",
        status: "contato_realizado",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("não autenticado");
    });

    it("deve rejeitar updateSdrProspectingStatus quando a RPC is_admin retornar false (assinante comum)", async () => {
      getSessionMock.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: "user-subscriber-uuid", email: "assinante@pro.com" },
          },
        },
        error: null,
      });

      rpcMock.mockResolvedValueOnce({ data: false, error: null });

      const res = await updateSdrProspectingStatus({
        leadId: "lead-sub-1",
        status: "abertura_iniciada",
      });

      expect(rpcMock).toHaveBeenCalledWith("is_admin", { _user_id: "user-subscriber-uuid" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REGRAS DO BANCO / TRIGGER: ALTERAÇÃO DE MARCADORES EXCLUSIVOS
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Regras de Banco / Trigger: Marcadores Exclusivos do SDR", () => {
    // Implementação de referência da lógica do trigger guard_sdr_lead_mutations
    function evaluateSdrTrigger({
      op,
      isAdmin,
      oldRow,
      newRow,
    }: {
      op: "INSERT" | "UPDATE";
      isAdmin: boolean;
      oldRow?: { status?: string; notas?: string | null };
      newRow: { status?: string; notas?: string | null };
    }): { allowed: boolean; error?: string } {
      if (isAdmin) return { allowed: true };

      if (op === "INSERT") {
        if (newRow.status === "abertura_iniciada") {
          return { allowed: false, error: "Acesso restrito: status abertura_iniciada é exclusivo do SDR." };
        }
        if (newRow.notas && newRow.notas.includes("[SDR WhatsApp")) {
          return { allowed: false, error: "Acesso restrito: logs [SDR WhatsApp] são exclusivos do SDR." };
        }
        return { allowed: true };
      }

      if (op === "UPDATE") {
        // Bloqueia transição para abertura_iniciada se não era antes
        if (newRow.status === "abertura_iniciada" && oldRow?.status !== "abertura_iniciada") {
          return { allowed: false, error: "Acesso restrito: transição para abertura_iniciada é exclusiva do SDR." };
        }

        // Verifica inserção de NOVOS marcadores [SDR WhatsApp
        if (newRow.notas && newRow.notas.includes("[SDR WhatsApp")) {
          const oldCount = (oldRow?.notas?.match(/\[SDR WhatsApp/gi) || []).length;
          const newCount = (newRow.notas.match(/\[SDR WhatsApp/gi) || []).length;
          if (newCount > oldCount) {
            return { allowed: false, error: "Acesso restrito: adição de novos logs [SDR WhatsApp] é restrita ao ADM." };
          }
        }
        return { allowed: true };
      }

      return { allowed: true };
    }

    it("não-admin não pode fazer INSERT com status abertura_iniciada", () => {
      const res = evaluateSdrTrigger({
        op: "INSERT",
        isAdmin: false,
        newRow: { status: "abertura_iniciada" },
      });
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("status abertura_iniciada");
    });

    it("não-admin não pode fazer INSERT com notas contendo tag [SDR WhatsApp]", () => {
      const res = evaluateSdrTrigger({
        op: "INSERT",
        isAdmin: false,
        newRow: { status: "novo", notas: "[SDR WhatsApp - 2026-10-27] Forjado" },
      });
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("logs [SDR WhatsApp]");
    });

    it("não-admin não pode transicionar status para abertura_iniciada no UPDATE", () => {
      const res = evaluateSdrTrigger({
        op: "UPDATE",
        isAdmin: false,
        oldRow: { status: "novo", notas: null },
        newRow: { status: "abertura_iniciada", notas: null },
      });
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("transição para abertura_iniciada");
    });

    it("não-admin não pode injetar uma nova tag [SDR WhatsApp] nas notas", () => {
      const res = evaluateSdrTrigger({
        op: "UPDATE",
        isAdmin: false,
        oldRow: { status: "em_contato", notas: "Nota normal do assinante" },
        newRow: { status: "em_contato", notas: "Nota normal\n[SDR WhatsApp - 2026-10-27] Status: contato_realizado" },
      });
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("adição de novos logs [SDR WhatsApp]");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ADMINISTRADOR UTILIZANDO O SDR
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Administrador Utilizando o SDR com Sucesso", () => {
    it("deve permitir updateSdrProspectingStatus quando RPC is_admin confirmar privilégio", async () => {
      getSessionMock.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: "admin-uuid", email: "jeferson.zanotell@gmail.com" },
          },
        },
        error: null,
      });

      rpcMock.mockResolvedValueOnce({ data: true, error: null });

      const singleMock = vi.fn().mockResolvedValue({
        data: { notas: "Nota anterior" },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleMock }) }) });
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });

      fromMock.mockImplementation((tbl: string) => {
        if (tbl === "leads") return { select: selectMock, update: updateMock };
        return {};
      });

      const res = await updateSdrProspectingStatus({
        leadId: "lead-adm-1",
        status: "contato_realizado",
        notes: "Abordagem enviada com sucesso",
      });

      expect(res.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. USUÁRIO EDITANDO O CRM DE UM LEAD QUE JÁ POSSUI HISTÓRICO DO SDR
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Preservação do CRM do Assinante em Leads com Histórico do SDR", () => {
    function evaluateSdrTriggerUpdate({
      isAdmin,
      oldRow,
      newRow,
    }: {
      isAdmin: boolean;
      oldRow: { status: string; notas: string | null };
      newRow: { status: string; notas: string | null };
    }) {
      if (isAdmin) return { allowed: true };
      if (newRow.status === "abertura_iniciada" && oldRow.status !== "abertura_iniciada") {
        return { allowed: false, error: "bloqueado status" };
      }
      if (newRow.notas && newRow.notas.includes("[SDR WhatsApp")) {
        const oldCount = (oldRow.notas?.match(/\[SDR WhatsApp/gi) || []).length;
        const newCount = (newRow.notas.match(/\[SDR WhatsApp/gi) || []).length;
        if (newCount > oldCount) {
          return { allowed: false, error: "bloqueado notas novas" };
        }
      }
      return { allowed: true };
    }

    it("assinante PODE avançar status de abertura_iniciada para em_contato ou fechado", () => {
      const res = evaluateSdrTriggerUpdate({
        isAdmin: false,
        oldRow: {
          status: "abertura_iniciada",
          notas: "[SDR WhatsApp - 2026-10-27] Status: abertura_iniciada",
        },
        newRow: {
          status: "em_contato",
          notas: "[SDR WhatsApp - 2026-10-27] Status: abertura_iniciada",
        },
      });
      expect(res.allowed).toBe(true);
    });

    it("assinante PODE adicionar notas normais do CRM preservando o histórico do SDR", () => {
      const res = evaluateSdrTriggerUpdate({
        isAdmin: false,
        oldRow: {
          status: "em_contato",
          notas: "[SDR WhatsApp - 2026-10-27] Status: contato_realizado",
        },
        newRow: {
          status: "em_contato",
          notas: "[SDR WhatsApp - 2026-10-27] Status: contato_realizado\n[Nota CRM] Reunião agendada com o Dr. Roberto para quinta-feira às 14h.",
        },
      });
      expect(res.allowed).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ABERTURA DO WHATSAPP SEM ENVIO AUTOMÁTICO E SEM CHAMADA GEMINI
  // ──────────────────────────────────────────────────────────────────────────
  describe("5. Abertura do WhatsApp Manual", () => {
    it("deve gerar link wa.me com telefone brasileiro correto e texto exato sem chamar IA", () => {
      const lead = {
        nome: "Clínica Odonto",
        cidade: "Vitória",
        nicho: "odontologia",
        telefone: "(27) 99888-7766",
        plano_prospecao_7dias: [
          {
            dia: 1,
            canal: "whatsapp" as const,
            titulo: "Abertura",
            mensagem: "Olá Dr. Ricardo, vi o trabalho da Clínica Odonto em Vitória.",
            objetivo: "Abertura",
            acao_sugerida: "Enviar WhatsApp",
            objecao_provavel: "Sem tempo",
            resposta_sugerida: "Compreendo perfeitamente",
            cta: "Podemos falar amanhã?",
          },
        ],
      };

      const res = generateSdrFirstApproachMessage({ lead, dayNumber: 1 });
      expect(res.isFromPlan).toBe(true);
      expect(res.text).toBe("Olá Dr. Ricardo, vi o trabalho da Clínica Odonto em Vitória.");
      expect(res.whatsappUrl).toBe(
        "https://wa.me/5527998887766?text=Ol%C3%A1%20Dr.%20Ricardo%2C%20vi%20o%20trabalho%20da%20Cl%C3%ADnica%20Odonto%20em%20Vit%C3%B3ria."
      );
      expect(res.targetPhone).toBe("5527998887766");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. RESPEITO AO OPT-OUT
  // ──────────────────────────────────────────────────────────────────────────
  describe("6. Respeito Rigoroso ao Opt-out", () => {
    it("deve bloquear abordagem quando o lead recusar contato", () => {
      const leadComOptOut = {
        nome: "Empresa X",
        status: "recusou_optout",
        notas: "[SDR WhatsApp - 2026-10-27] Status: opt-out (recusa de contato registrada - bloqueio permanente)",
      };
      expect(hasExplicitOptOut(leadComOptOut as any)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. CADASTRO E LEITURA DO PERFIL COMERCIAL
  // ──────────────────────────────────────────────────────────────────────────
  describe("7. Cadastro e Validação do Perfil Comercial", () => {
    it("deve considerar perfil completo apenas com todos os campos válidos", () => {
      const completo: SellerProfile = {
        display_name: "Jeferson Zanotelli",
        company_name: "Zuno Marketing",
        service_category: "trafego",
        service_offered: "Gestão de Tráfego Pago e Google Ads",
        offer_description: "Campanhas locais de Google e Meta Ads com foco em geração de leads qualificados semanais.",
        target_audience: "Clínicas e negócios locais",
      };
      expect(isSellerProfileComplete(completo)).toBe(true);
    });

    it("deve rejeitar perfil se faltar nome, serviço ou descrição mínima de 20 caracteres", () => {
      const incompleto: SellerProfile = {
        display_name: "",
        company_name: "",
        service_category: "",
        service_offered: "Tráfego",
        offer_description: "Curto",
        target_audience: "",
      };
      expect(isSellerProfileComplete(incompleto)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. FALHA DE PERFIL SEM CHAMADA GEMINI
  // ──────────────────────────────────────────────────────────────────────────
  describe("8. Falha de Perfil Sem Chamada Gemini", () => {
    it("evaluatePreconditions retorna REFINE_PROFILE_REQUIRED antes de IA ou crédito", () => {
      const emptyProfile = sanitizeSellerProfile(null);
      const blocked = evaluatePreconditions({
        profile: emptyProfile,
        stage: "novo_sem_contato",
        existingPlan: null,
        replaceExisting: true,
      });

      expect(blocked).not.toBeNull();
      expect(blocked?.code).toBe("REFINE_PROFILE_REQUIRED");
      expect(blocked?.status).toBe(422);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. COMPATIBILIDADE ENTRE VERSÕES DURANTE A PUBLICAÇÃO (ZERO DOWNTIME)
  // ──────────────────────────────────────────────────────────────────────────
  describe("9. Transição e Compatibilidade de Publicação", () => {
    const validProfile: SellerProfile = {
      display_name: "Consultor Carlos",
      company_name: "Agência Crescer",
      service_category: "trafego",
      service_offered: "Tráfego e Anúncios Locais",
      offer_description: "Estruturação de funil de vendas e tráfego pago para atrair clientes da cidade.",
      target_audience: "Pequenas empresas",
    };

    it("lê do banco de dados quando a tabela seller_profiles existir (fonte primária e única)", async () => {
      const adminMock = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: validProfile,
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await loadSellerProfileForUser(adminMock as any, "user-123");
      expect(result.display_name).toBe("Consultor Carlos");
      expect(result.service_category).toBe("trafego");
    });

    it("tabela ausente ou erro de leitura retorna perfil vazio, acionando 422 seguro sem cobrar crédito", async () => {
      const adminMock = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockRejectedValue(new Error('relation "seller_profiles" does not exist')),
            }),
          }),
        }),
      };

      const result = await loadSellerProfileForUser(adminMock as any, "user-123");
      expect(isSellerProfileComplete(result)).toBe(false);

      const blocked = evaluatePreconditions({
        profile: result,
        stage: "novo_sem_contato",
        existingPlan: null,
        replaceExisting: true,
      });
      expect(blocked?.code).toBe("REFINE_PROFILE_REQUIRED");
      expect(blocked?.status).toBe(422);
    });

    it("perfil lido no servidor consulta restritamente o user_id autenticado", async () => {
      const eqMock = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const adminMock = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ eq: eqMock }),
        }),
      };

      await loadSellerProfileForUser(adminMock as any, "user-authenticated-456");
      expect(adminMock.from).toHaveBeenCalledWith("seller_profiles");
      expect(eqMock).toHaveBeenCalledWith("user_id", "user-authenticated-456");
    });
  });
});
