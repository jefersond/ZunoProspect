// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const copyToClipboard = vi.fn(async (_text: string) => true);
const toast = vi.fn();

vi.mock("@/utils/templateUtils", () => ({ copyToClipboard: (text: string) => copyToClipboard(text) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));

import { LeadAnalysis } from "./LeadAnalysis";
import { makeLegacyLead, makeNewLead } from "@/test/leadFixtures";

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

  it("lead novo sem probabilidade numérica: renderiza diagnóstico, alinhamento cadastral e os 7 dias", () => {
    const lead = makeNewLead();
    expect(lead.probabilidade_conversao).toBeNull();
    renderAnalysis(lead);

    expect(screen.getByText("Diagnostico Comercial IA")).toBeTruthy();
    expect(screen.getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
    expect(screen.queryByText(/Probabilidade de Conversao/i)).toBeNull();
    for (const bullet of lead.diagnostico_bullets) expect(screen.getAllByText(bullet).length).toBeGreaterThan(0);
    for (let d = 1; d <= 7; d++) expect(screen.getByText(`Dia ${d}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain("Compatibilidade não determinada");
  });

  it("lead antigo (probabilidade legada, foco nulo, plano antigo) renderiza sem lançar ReferenceError/TypeError", () => {
    const lead = makeLegacyLead();
    expect(() => renderAnalysis(lead)).not.toThrow();

    expect(screen.getByText("Diagnóstico antigo 1")).toBeTruthy();
    for (let d = 1; d <= 7; d++) {
      expect(screen.getByText(`Dia ${d}`)).toBeTruthy();
      expect(screen.getByText(`Mensagem antiga personalizada do dia ${d}`)).toBeTruthy();
    }
    expect(screen.getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
  });

  it("sem lead, usa a prop compatibilidade quando informada e o fallback textual quando não", () => {
    const lead = makeNewLead();
    const { unmount } = renderAnalysis(lead, {
      lead: null,
      compatibilidade: { level: "alta", label: "Alinhamento alto (teste)", description: "descrição de teste", criteria: [] } as never,
    });
    expect(screen.getByText("Alinhamento alto (teste)")).toBeTruthy();
    unmount();

    renderAnalysis(lead, { lead: null });
    expect(screen.getByText("Compatibilidade não determinada")).toBeTruthy();
  });

  it("estado vazio (sem plano) continua exibindo o aviso e não quebra", () => {
    renderAnalysis(makeNewLead(), { plano: [] });
    expect(screen.getByText(/Analise premium de IA ainda nao gerada/)).toBeTruthy();
  });

  it("botão 'Atualizar Cópias' só aparece com handler, dispara o handler e fica desabilitado enquanto atualiza", () => {
    const lead = makeNewLead();
    const { unmount } = renderAnalysis(lead);
    expect(screen.queryByText(/Atualizar Cópias/)).toBeNull();
    unmount();

    const onUpdate = vi.fn();
    const first = renderAnalysis(lead, { onUpdateCopiesLocally: onUpdate });
    fireEvent.click(screen.getByText(/Atualizar Cópias/));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    first.unmount();

    renderAnalysis(lead, { onUpdateCopiesLocally: onUpdate, isUpdatingCopiesLocally: true });
    const busy = screen.getByText("Atualizando...").closest("button") as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });

  it("'Executar no SDR' chama o handler com o número do dia clicado", () => {
    const onExecute = vi.fn();
    renderAnalysis(makeNewLead(), { onExecuteInSdr: onExecute });
    const buttons = screen.getAllByText("Executar no SDR");
    expect(buttons).toHaveLength(7);
    fireEvent.click(buttons[3]);
    expect(onExecute).toHaveBeenCalledWith(4);
  });

  it("copiar mensagem copia exatamente a mensagem do dia", async () => {
    const lead = makeNewLead();
    renderAnalysis(lead);
    const day1 = lead.plano_prospecao_7dias.find((d) => d.dia === 1)!;
    const copyButton = screen.getAllByText("Mensagem:")[0].parentElement!.querySelector("button")!;
    fireEvent.click(copyButton);
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(day1.mensagem));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copiado!" }));
  });
});
