// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const copyToClipboard = vi.fn(async (_text: string) => true);
const toast = vi.fn();

vi.mock("@/utils/templateUtils", () => ({ copyToClipboard: (text: string) => copyToClipboard(text) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));

import { LeadAnalysis } from "./LeadAnalysis";
import { FIXTURE_DAY1_TEXT, makeLeadWithoutPlan, makeLegacyLead, makeNewLead } from "@/test/leadFixtures";

const renderAnalysis = (lead: ReturnType<typeof makeNewLead>, extra: Partial<React.ComponentProps<typeof LeadAnalysis>> = {}) =>
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

describe("LeadAnalysis (renderização real)", () => {
  beforeEach(() => {
    copyToClipboard.mockClear();
    toast.mockClear();
  });
  afterEach(cleanup);

  it("plano novo: diagnóstico estruturado, alinhamento cadastral e 7 dias com tipos diferentes (não são 7 mensagens)", () => {
    const lead = makeNewLead();
    renderAnalysis(lead);

    expect(screen.getByText("Diagnostico Comercial IA")).toBeTruthy();
    expect(screen.getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
    expect(screen.queryByText(/Probabilidade de Conversao/i)).toBeNull();
    for (const bullet of lead.diagnostico_bullets) expect(screen.getByText(bullet)).toBeTruthy();
    for (let d = 1; d <= 7; d++) expect(screen.getByTestId(`dia-${d}`)).toBeTruthy();

    const types = [1, 2, 3, 4, 5, 6, 7].map((d) => screen.getByTestId(`dia-${d}`).getAttribute("data-tipo"));
    expect(types).toEqual(["mensagem", "tarefa", "sem_mensagem", "acompanhamento", "sem_mensagem", "tarefa", "sem_mensagem"]);
    expect(screen.getAllByText("Mensagem:")).toHaveLength(2);
    expect(screen.getAllByText("Nenhuma mensagem necessária nesta etapa")).toHaveLength(5);
    expect(document.body.textContent).not.toContain("Compatibilidade não determinada");
  });

  it("dia de tarefa mostra o que fazer e nenhuma caixa de mensagem; dia de ligação mostra o canal", () => {
    renderAnalysis(makeNewLead());
    const tarefa = screen.getByTestId("dia-2");
    expect(within(tarefa).getByText("Tarefa")).toBeTruthy();
    expect(within(tarefa).getByText(/Pesquise o nome da oficina/)).toBeTruthy();
    expect(within(tarefa).queryByText("Mensagem:")).toBeNull();
    expect(within(screen.getByTestId("dia-6")).getByText("Ligação")).toBeTruthy();
  });

  it("acompanhamento mostra quando enviar", () => {
    renderAnalysis(makeNewLead());
    const d4 = screen.getByTestId("dia-4");
    expect(within(d4).getByText("Acompanhamento")).toBeTruthy();
    expect(within(d4).getByText(/Só se o Dia 1 foi enviado/)).toBeTruthy();
  });

  it("lead antigo (probabilidade legada, foco nulo, plano sem tipo_dia) renderiza as 7 mensagens como estavam", () => {
    const lead = makeLegacyLead();
    expect(() => renderAnalysis(lead)).not.toThrow();
    expect(screen.getByText("Diagnóstico antigo 1")).toBeTruthy();
    for (let d = 1; d <= 7; d++) {
      expect(screen.getByText(`Mensagem antiga personalizada do dia ${d}`)).toBeTruthy();
      expect(screen.getByTestId(`dia-${d}`).getAttribute("data-tipo")).toBe("mensagem");
    }
    expect(screen.getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
  });

  it("sem lead, usa a prop compatibilidade quando informada e o fallback textual quando não", () => {
    const lead = makeNewLead();
    const { unmount } = renderAnalysis(lead, {
      lead: null,
      compatibilidade: { level: "alta", label: "Alinhamento alto (teste)", description: "descrição de teste", criteria: [], score: null },
    });
    expect(screen.getByText("Alinhamento alto (teste)")).toBeTruthy();
    unmount();

    renderAnalysis(lead, { lead: null });
    expect(screen.getByText("Compatibilidade não determinada")).toBeTruthy();
  });

  it("sem plano salvo: não inventa nada, pede a geração e oferece o perfil comercial", () => {
    const lead = makeLeadWithoutPlan();
    const onEdit = vi.fn();
    const onReanalyze = vi.fn();
    renderAnalysis(lead, { diagnostico: [], plano: [], onEditSellerProfile: onEdit, onReanalyze, lead: null });
    expect(screen.getByText(/Analise premium de IA ainda nao gerada/)).toBeTruthy();
    expect(screen.queryByText("Mensagem:")).toBeNull();
    fireEvent.click(screen.getByText("Meu perfil comercial"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Gerar análise com IA"));
    expect(onReanalyze).toHaveBeenCalledTimes(1);
  });

  it("não existe mais 'Atualizar Cópias': reescrever texto de IA com modelo estático foi removido", () => {
    renderAnalysis(makeNewLead(), { onReanalyze: vi.fn() });
    expect(document.body.textContent).not.toMatch(/Atualizar C[óo]pias/);
    expect(screen.getByText("Gerar nova versão com IA")).toBeTruthy();
  });

  it("'Executar no SDR' só aparece nos dias com mensagem e chama o handler com o dia certo", () => {
    const onExecute = vi.fn();
    renderAnalysis(makeNewLead(), { onExecuteInSdr: onExecute });
    const buttons = screen.getAllByText("Executar no SDR");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onExecute).toHaveBeenCalledWith(4);
    expect(within(screen.getByTestId("dia-2")).queryByText("Executar no SDR")).toBeNull();
  });

  it("copiar mensagem copia exatamente o texto salvo do dia", async () => {
    renderAnalysis(makeNewLead());
    const copyButton = screen.getAllByText("Mensagem:")[0].parentElement!.querySelector("button")!;
    fireEvent.click(copyButton);
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(FIXTURE_DAY1_TEXT));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copiado!" }));
  });
});
