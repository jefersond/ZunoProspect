// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const toast = vi.fn();
const copyToClipboardMock = vi.fn(async () => true);
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));
vi.mock("@/utils/templateUtils", () => ({ copyToClipboard: (...a: unknown[]) => copyToClipboardMock(...a) }));

const openSellerProfileMock = vi.fn();
vi.mock("@/lib/sellerProfile", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/sellerProfile")>();
  return {
    ...mod,
    openSellerProfileDialog: () => openSellerProfileMock(),
  };
});

import { LeadAnalysis } from "./LeadAnalysis";
import { makeNewLead } from "@/test/leadFixtures";
import { resetSellerProfileStateForTests, loadSellerProfileForUser, saveSellerProfile } from "@/lib/sellerProfile";
import type { LeadProspeccao } from "@/types/lead";

const SAMPLE_BULLETS = [
  "Clínica Sorriso atua no segmento de odontologia em Vitória.",
  "Sinais observados: site informado e 80 avaliações no Google.",
  "Possibilidade comercial: avaliar captação previsível de novos pacientes.",
  "Próximo passo útil: enviar mensagem curta e consultiva.",
];

const renderComponent = (lead: LeadProspeccao, extra: Partial<React.ComponentProps<typeof LeadAnalysis>> = {}) =>
  render(
    <LeadAnalysis
      lead={lead}
      diagnostico={lead.diagnostico_bullets}
      probabilidade={lead.probabilidade_conversao ?? null}
      plano={lead.plano_prospecao_7dias}
      geradoEm={lead.ai_analise_gerada_em}
      {...extra}
    />
  );

describe("LeadAnalysis · Pacote Comercial Completo, Contingências e Identificação de Origem", () => {
  beforeEach(async () => {
    toast.mockClear();
    copyToClipboardMock.mockClear();
    openSellerProfileMock.mockClear();
    resetSellerProfileStateForTests();
    await loadSellerProfileForUser("user-1");
  });
  afterEach(cleanup);

  it("1. Exibe identificação discreta 'Sugestão inicial' quando a análise não é do Gemini", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, geradoEm: null });

    const badgeHeader = screen.getByTestId("initial-suggestion-badge");
    expect(badgeHeader.textContent).toContain("Sugestão inicial");

    const badgeSummary = screen.getByTestId("summary-initial-badge");
    expect(badgeSummary.textContent).toContain("Sugestão inicial");
  });

  it("2. Posiciona o card de destaque com identidade Zuno após o Resumo Comercial", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn() });

    const summary = screen.getByTestId("analysis-summary");
    const highlightCard = screen.getByTestId("refine-highlight-card");
    const companyData = screen.getByTestId("company-data");

    // Verifica posicionamento relativo
    expect(summary.compareDocumentPosition(highlightCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(highlightCard.compareDocumentPosition(companyData) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Título convidativo do plano comercial completo
    expect(within(highlightCard).getByText("Deseja gerar o plano comercial completo para este lead?")).toBeTruthy();
  });

  it("3. Utiliza o botão principal 'Gerar plano comercial completo com IA' e dispara a ação ao clicar", () => {
    const onReanalyze = vi.fn();
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze, canAnalyzeAI: true });

    const button = screen.getByTestId("btn-refinar-abordagem-ia");
    expect(button.textContent).toContain("Gerar plano comercial completo com IA");

    fireEvent.click(button);
    expect(onReanalyze).toHaveBeenCalledTimes(1);
  });

  it("4. Inclui a explicação breve exata sobre o plano comercial completo e acompanhamento", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn() });

    const highlightCard = screen.getByTestId("refine-highlight-card");
    expect(
      within(highlightCard).getByText(
        "Receba uma análise aprofundada, mensagens personalizadas e uma estratégia de acompanhamento para esta empresa."
      )
    ).toBeTruthy();
  });

  it("5. Quando refinamento concluído com Gemini, exibe rótulo claro 'Personalizado com IA' e oculta o card inicial", () => {
    const lead = {
      ...makeNewLead(),
      ai_analise_gerada_em: "2026-10-29T10:00:00Z",
      ai_used_fallback: false,
    } as LeadProspeccao;

    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, geradoEm: lead.ai_analise_gerada_em, onReanalyze: vi.fn() });

    // Card inicial de destaque NÃO deve existir após personalização com IA
    expect(screen.queryByTestId("refine-highlight-card")).toBeNull();

    // Bloco de confirmação com IA visível
    const successBlock = screen.getByTestId("refined-success-block");
    expect(within(successBlock).getByText("Personalizado com IA")).toBeTruthy();
    expect(within(successBlock).getByText(/Plano comercial completo e estratégia de acompanhamento/)).toBeTruthy();

    // Badges no cabeçalho e resumo atualizados
    expect(screen.getByTestId("summary-gemini-badge").textContent).toContain("Personalizado com IA");
    expect(screen.getByTestId("analysis-origin").textContent).toContain("Personalizado com IA");
  });

  it("6. Alerta de perfil comercial incompleto orienta o usuário e oferece acesso direto via modal", async () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn() });

    const warning = screen.getByTestId("profile-incomplete-warning");
    expect(within(warning).getByText("Seu perfil comercial ainda não está completo.")).toBeTruthy();

    const openProfileBtn = within(warning).getByText("Completar perfil agora");
    fireEvent.click(openProfileBtn);
    expect(openSellerProfileMock).toHaveBeenCalledTimes(1);
  });

  it("7. Com perfil comercial completo, oculta o aviso de perfil incompleto", async () => {
    await saveSellerProfile({
      display_name: "Consultor Carlos",
      company_name: "Carlos Estratégia",
      service_category: "trafego",
      service_offered: "Gestão de Anúncios Google",
      offer_description: "Atraio clientes qualificados com campanhas locais de alta conversão.",
      target_audience: "Clínicas e negócios locais",
    });

    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn() });

    expect(screen.queryByTestId("profile-incomplete-warning")).toBeNull();
  });

  it("8. Exibe consumo prévio de créditos quando há saldo disponível", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn(), canAnalyzeAI: true });

    const highlightCard = screen.getByTestId("refine-highlight-card");
    expect(within(highlightCard).getByText("Consome 1 análise de IA do seu plano.")).toBeTruthy();
  });

  it("9. Exibe aviso de limite e botão de liberação quando não há saldo de IA", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS, onReanalyze: vi.fn(), canAnalyzeAI: false });

    const highlightCard = screen.getByTestId("refine-highlight-card");
    expect(within(highlightCard).getByText("Limite de análises IA atingido neste ciclo.")).toBeTruthy();
    expect(within(highlightCard).getByText("Liberar análises IA")).toBeTruthy();
  });

  it("10. Primeira abordagem em destaque no Dia 1 possui badge visual e botão de cópia", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS });

    const day1Item = screen.getByTestId("dia-1");
    expect(within(day1Item).getByText("Primeira Abordagem")).toBeTruthy();
    expect(within(day1Item).getByLabelText("Copiar mensagem do Dia 1")).toBeTruthy();
  });

  it("11. Renderiza o Guia de Objeções e Respostas com os 7 cenários comerciais táticos", () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS });

    const contingenciesCard = screen.getByTestId("analysis-contingencies");
    expect(within(contingenciesCard).getByText("Objeções e Respostas Rápidas")).toBeTruthy();

    const expectedScenarios = [
      "contingency-interesse",
      "contingency-mais_informacoes",
      "contingency-ja_possui_fornecedor",
      "contingency-nao_e_o_momento",
      "contingency-contato_nao_e_responsavel",
      "contingency-nao_respondeu",
      "contingency-pediu_para_parar",
    ];

    for (const testId of expectedScenarios) {
      expect(screen.getByTestId(testId)).toBeTruthy();
    }
  });

  it("12. Copiar resposta de contingência invoca copyToClipboard sem computar contatos", async () => {
    const lead = makeNewLead();
    renderComponent(lead, { diagnostico: SAMPLE_BULLETS });

    const copyBtn = screen.getByLabelText("Copiar resposta para O lead demonstrou interesse");
    fireEvent.click(copyBtn);

    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copiado!" })));
  });
});
