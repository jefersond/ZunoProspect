// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const copyToClipboard = vi.fn(async (_text: string) => true);
const toast = vi.fn();

vi.mock("@/utils/templateUtils", () => ({ copyToClipboard: (text: string) => copyToClipboard(text) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));

import { LeadAnalysis } from "./LeadAnalysis";
import { makeNewLead } from "@/test/leadFixtures";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import { isLeadInAdvancedStage, validateLeadChannelForDay } from "@/utils/analysisPresentation";

const TYPICAL_BULLETS = [
  "Clínica Sorriso atua no segmento de clínica odontológica em Curitiba.",
  "Sinais observados: 142 avaliações no Google (nota 4.8).",
  "Hipótese comercial: A implantação de triagem no WhatsApp pode agilizar o atendimento.",
  "Pergunta para validar: Como vocês organizam a confirmação de consultas?",
];

const renderAnalysis = (lead: LeadProspeccao, extra: Partial<React.ComponentProps<typeof LeadAnalysis>> = {}) =>
  render(
    <LeadAnalysis
      lead={lead}
      diagnostico={lead.diagnostico_bullets}
      probabilidade={lead.probabilidade_conversao ?? null}
      plano={lead.plano_prospecao_7dias}
      geradoEm={lead.ai_analise_gerada_em}
      {...extra}
    />,
  );

describe("LeadAnalysis · Cadência Inteligente (Qualidade Comercial e Usabilidade)", () => {
  beforeEach(() => {
    copyToClipboard.mockClear();
    toast.mockClear();
  });
  afterEach(cleanup);

  describe("1. Dia 7 sem quarta tentativa (máximo 3 mensagens ativas)", () => {
    it("cadência inteligente tem no máximo 3 mensagens ativas (dias 1, 3 e 5) e Dia 7 é estritamente tarefa de CRM", () => {
      const lead = makeNewLead();
      // Plano com jornada de trabalho semanal de 3 mensagens:
      const plano3Mensagens: PlanoProspeccaoDia[] = [
        { dia: 1, tipo_dia: "mensagem", canal: "whatsapp", mensagem: "Olá Dia 1", status_dia: "pendente" },
        { dia: 2, tipo_dia: "tarefa", canal: "nenhum", mensagem: "", status_dia: "pendente", acao_sugerida: "Aguardar retorno" },
        { dia: 3, tipo_dia: "mensagem", canal: "email", mensagem: "Olá Dia 3", status_dia: "pendente" },
        { dia: 4, tipo_dia: "tarefa", canal: "nenhum", mensagem: "", status_dia: "pendente", acao_sugerida: "Pesquisar site" },
        { dia: 5, tipo_dia: "mensagem", canal: "whatsapp", mensagem: "Olá Dia 5", status_dia: "pendente" },
        { dia: 6, tipo_dia: "tarefa", canal: "nenhum", mensagem: "", status_dia: "pendente", acao_sugerida: "Atualizar CRM" },
        { dia: 7, tipo_dia: "tarefa", canal: "nenhum", mensagem: "", status_dia: "pendente", acao_sugerida: "Encerrar cadência no CRM" },
      ];

      renderAnalysis(lead, { plano: plano3Mensagens });

      const diasComMensagem = plano3Mensagens.filter((d) => Boolean(d.mensagem?.trim()));
      expect(diasComMensagem).toHaveLength(3);
      expect(diasComMensagem.map((d) => d.dia)).toEqual([1, 3, 5]);

      // Dia 7 não possui mensagem e renderiza badge Tarefa / Pausa / CRM
      const dia7 = screen.getByTestId("dia-7");
      expect(within(dia7).getByText("Tarefa / Pausa / CRM")).toBeTruthy();
      expect(within(dia7).getByTestId("dia-7-sem-mensagem")).toBeTruthy();
      expect(within(dia7).queryByText("Mensagem pronta")).toBeNull();
    });
  });

  describe("2. Cadência condicionada ao estado real do lead no CRM", () => {
    it("identifica corretamente status de funil avançado", () => {
      expect(isLeadInAdvancedStage("novo")).toBe(false);
      expect(isLeadInAdvancedStage("em_contato")).toBe(false);
      expect(isLeadInAdvancedStage("qualificacao")).toBe(true);
      expect(isLeadInAdvancedStage("negociacao")).toBe(true);
      expect(isLeadInAdvancedStage("convertido")).toBe(true);
      expect(isLeadInAdvancedStage("perdido")).toBe(true);
    });

    it("lead em 'qualificacao': desativa recomendação de cadência fria e exibe card orientativo de qualificação", () => {
      const lead = { ...makeNewLead(), status: "qualificacao" } as LeadProspeccao;
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      // Não exibe card de próximo passo de prospecção fria
      expect(screen.queryByTestId("analysis-next-step")).toBeNull();

      // Exibe card orientativo do funil
      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Lead em Qualificação \(Interesse Demonstrado\)/)).toBeTruthy();
      expect(within(guidance).getByText(/A cadência de prospecção fria foi pausada/)).toBeTruthy();

      // Exibe aviso de cadência fria desativada no topo do plano
      expect(screen.getByTestId("plan-funnel-paused")).toBeTruthy();
    });

    it("lead em 'negociacao': desativa cadência fria e orienta foco em proposta e fechamento", () => {
      const lead = { ...makeNewLead(), status: "negociacao" } as LeadProspeccao;
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      expect(screen.queryByTestId("analysis-next-step")).toBeNull();
      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Lead em Negociação Ativa/)).toBeTruthy();
      expect(screen.getByTestId("plan-funnel-paused")).toBeTruthy();
    });

    it("lead em 'convertido': exibe parabéns por conversão e não sugere cold outreach", () => {
      const lead = { ...makeNewLead(), status: "convertido" } as LeadProspeccao;
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      expect(screen.queryByTestId("analysis-next-step")).toBeNull();
      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Lead Convertido com Sucesso/)).toBeTruthy();
    });

    it("lead em 'perdido': exibe aviso de oportunidade arquivada sem recomendar envio frio", () => {
      const lead = { ...makeNewLead(), status: "perdido" } as LeadProspeccao;
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      expect(screen.queryByTestId("analysis-next-step")).toBeNull();
      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Oportunidade Encerrada \(Perdido\)/)).toBeTruthy();
    });

    it("lead no funil avançado desabilita botões do SDR com aviso contextual", () => {
      const onExecute = vi.fn();
      const lead = { ...makeNewLead(), status: "qualificacao" } as LeadProspeccao;
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, onExecuteInSdr: onExecute });

      const buttons = screen.getAllByText("Executar no SDR").map((n) => n.closest("button") as HTMLButtonElement);
      expect(buttons.every((b) => b.disabled)).toBe(true);

      fireEvent.click(buttons[0]);
      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe("3. Canais disponíveis e ausência de dados cadastrais", () => {
    it("valida canal de e-mail ausente sem inventar dados", () => {
      const leadSemEmail = { ...makeNewLead(), email: null } as LeadProspeccao;
      const validation = validateLeadChannelForDay(leadSemEmail, "email");

      expect(validation.isAvailable).toBe(false);
      expect(validation.warningBadge).toBe("E-mail não cadastrado");
      expect(validation.suggestedAlternative).toContain("WhatsApp comercial");
    });

    it("renderiza advertência no dia de e-mail quando a empresa não possui e-mail cadastrado", () => {
      const lead = { ...makeNewLead(), email: null } as LeadProspeccao;
      renderAnalysis(lead);

      const dia3 = screen.getByTestId("dia-3");
      expect(within(dia3).getByTestId("dia-3-channel-warning-badge")).toBeTruthy();
      expect(within(dia3).getByText("E-mail não cadastrado")).toBeTruthy();
      expect(within(dia3).getByTestId("dia-3-channel-warning")).toBeTruthy();
      expect(within(dia3).getByText(/Não há endereço de e-mail registrado/)).toBeTruthy();
    });

    it("telefone fixo sem WhatsApp confirmado no site gera aviso sem afirmar compatibilidade", () => {
      const leadFixo = {
        ...makeNewLead(),
        telefone: "4133445566", // 10 dígitos -> fixo
        whatsapp_link: null,
        whatsapp_number: null,
        sinais: { has_whatsapp_on_site: false },
      } as unknown as LeadProspeccao;

      const validation = validateLeadChannelForDay(leadFixo, "whatsapp");
      expect(validation.isAvailable).toBe(false);
      expect(validation.warningBadge).toBe("WhatsApp não confirmado");
      expect(validation.suggestedAlternative).toContain("Ligue na recepção");

      renderAnalysis(leadFixo);
      const dia1 = screen.getByTestId("dia-1");
      expect(within(dia1).getByTestId("dia-1-channel-warning-badge")).toBeTruthy();
      expect(within(dia1).getByText("WhatsApp não confirmado")).toBeTruthy();
    });

    it("telefone celular com DDD Curitiba (11 dígitos) tem WhatsApp disponível sem aviso de canal", () => {
      const leadCelular = {
        ...makeNewLead(),
        telefone: "41999887766", // 11 dígitos com 9 -> celular
        sinais: { has_whatsapp_on_site: true },
      } as LeadProspeccao;

      const validation = validateLeadChannelForDay(leadCelular, "whatsapp");
      expect(validation.isAvailable).toBe(true);

      renderAnalysis(leadCelular);
      const dia1 = screen.getByTestId("dia-1");
      expect(within(dia1).queryByTestId("dia-1-channel-warning-badge")).toBeNull();
    });
  });

  describe("4. Próxima Melhor Ação (Next Best Action - NBA) no LeadAnalysis", () => {
    it("lead novo exibe card de Próxima Melhor Ação com motivo claro e ação do Dia 1", () => {
      const lead = makeNewLead();
      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      const nba = screen.getByTestId("analysis-next-step");
      expect(within(nba).getByText(/Enviar Primeira Abordagem via WhatsApp/)).toBeTruthy();
      expect(within(nba).getByText("Primeira Abordagem · Novo")).toBeTruthy();
      expect(within(nba).getByText(/Por que agora:/)).toBeTruthy();
      expect(within(nba).getByText(/sem histórico de contato registrado/)).toBeTruthy();
      expect(within(nba).getByText(/Como agir:/)).toBeTruthy();
    });

    it("lead em contato recente (< 48h) exibe pausa técnica e aguardar retorno sem insistência diária", () => {
      const fixedWednesday = new Date("2026-10-28T14:00:00Z"); // quarta-feira útil
      const lead = {
        ...makeNewLead(),
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            ultima_interacao_em: new Date(fixedWednesday.getTime() - 6 * 3600 * 1000).toISOString(), // 6 horas atrás
            ultimo_canal_interacao: "whatsapp",
          },
        },
      } as unknown as LeadProspeccao;

      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, simulatedNow: fixedWednesday });

      const nba = screen.getByTestId("analysis-next-step");
      expect(within(nba).getByText(/Aguardar Retorno Natural da Recepção/)).toBeTruthy();
      expect(within(nba).getByText("Intervalo Técnico · Em Espera")).toBeTruthy();
      expect(within(nba).getByText(/Contatos diários consecutivos geram percepção de insistência/)).toBeTruthy();
      expect(within(nba).getByText(/Mantenha a pausa técnica de 48h/)).toBeTruthy();
    });

    it("lead que perguntou preço orienta resposta consultiva e desativa envio frio", () => {
      const lead = {
        ...makeNewLead(),
        status: "em_contato",
        notas: "Recepcionista perguntou qual o preco da implantacao",
      } as LeadProspeccao;

      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      // Como o lead solicitou valores, a cadência fria é desativada
      expect(screen.queryByTestId("analysis-next-step")).toBeNull();
      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Responder Solicitação de Informações \/ Valores/)).toBeTruthy();
      expect(within(guidance).getByText("Solicitou Informações")).toBeTruthy();
      expect(within(guidance).getByText(/Não envie mensagens de prospecção genéricas/)).toBeTruthy();
    });

    it("exibe badge com follow-up agendado quando registrado no fluxo operacional do CRM", () => {
      const followUpDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const lead = {
        ...makeNewLead(),
        status: "qualificacao",
        custom_fields: {
          crm_flow: {
            proximo_follow_up_em: followUpDate,
            proxima_acao: "Ligar para confirmar reunião de demonstração",
          },
        },
      } as unknown as LeadProspeccao;

      renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });

      const guidance = screen.getByTestId("funnel-stage-guidance");
      expect(within(guidance).getByText(/Follow-up agendado:/)).toBeTruthy();
      expect(within(guidance).getByText(/Ligar para confirmar reunião de demonstração/)).toBeTruthy();
    });
  });
});
