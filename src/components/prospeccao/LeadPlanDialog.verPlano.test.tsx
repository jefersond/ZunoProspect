// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const updateSpy = vi.fn();
const invokeSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (payload: unknown) => {
      updateSpy(payload);
      return chain;
    },
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: (...a: unknown[]) => invokeSpy(...a) },
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  };
});
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ subscription: { plan_name: "pro" }, loading: false, isAdmin: false }),
}));
vi.mock("@/hooks/useUsage", () => ({
  useUsage: () => ({ usage: { plan_name: "pro" }, canAnalyzeAI: true, refetch: vi.fn(), isAdmin: false }),
}));
vi.mock("@/components/templates/TemplateSelector", () => ({ TemplateSelector: () => null }));
vi.mock("@/components/profile/UpgradePlanDialog", () => ({ UpgradePlanDialog: () => null }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));
const copyToClipboard = vi.fn(async (_text: string) => true);
vi.mock("@/utils/templateUtils", async (orig) => ({
  ...(await orig<object>()),
  copyToClipboard: (text: string) => copyToClipboard(text),
}));

import { LeadPlanDialog } from "./LeadPlanDialog";
import { generateSdrFirstApproachMessage } from "@/services/sdrProspectingService";
import { makeLegacyLead, makeNewLead } from "@/test/leadFixtures";
import type { LeadProspeccao } from "@/types/lead";

// Reproduz o contrato de LeadsList/LeadsSalvos: o botão "Ver Plano" seleciona o lead e abre o dialog.
const Harness = ({ lead, onRefined }: { lead: LeadProspeccao; onRefined?: (l: LeadProspeccao) => void }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LeadProspeccao | null>(null);
  return (
    <>
      <button onClick={() => { setSelected(lead); setOpen(true); }}>Ver Plano</button>
      <LeadPlanDialog lead={selected} open={open} onOpenChange={setOpen} onLeadRefined={onRefined} />
    </>
  );
};

describe("Ver Plano → LeadPlanDialog", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    invokeSpy.mockClear();
    copyToClipboard.mockClear();
  });
  afterEach(cleanup);

  it.each([
    ["lead novo", makeNewLead, 7],
    ["lead antigo", makeLegacyLead, 7],
  ])("%s: clicar em Ver Plano abre o modal com diagnóstico e 7 dias, sem erro", async (_n, make, days) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lead = make();
    render(<Harness lead={lead} />);

    fireEvent.click(screen.getByText("Ver Plano"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(lead.nome)).toBeTruthy();
    expect(within(dialog).getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
    for (let d = 1; d <= days; d++) expect(within(dialog).getByText(`Dia ${d}`)).toBeTruthy();
    expect(within(dialog).getAllByText("Executar no SDR")).toHaveLength(days);
    expect(invokeSpy).not.toHaveBeenCalled(); // nenhuma Edge Function / IA acionada ao abrir
    expect(errorSpy.mock.calls.filter((c) => String(c[0]).includes("ReferenceError"))).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("lead antigo: a mensagem de cada dia é exibida exatamente como salva (edições preservadas)", async () => {
    const lead = makeLegacyLead();
    render(<Harness lead={lead} />);
    fireEvent.click(screen.getByText("Ver Plano"));
    const dialog = await screen.findByRole("dialog");
    for (const d of lead.plano_prospecao_7dias) {
      expect(within(dialog).getByText(d.mensagem)).toBeTruthy();
    }
  });

  it("Atualizar Cópias usa o handler local do dialog (sem IA), grava e preserva mensagem editada", async () => {
    const lead = makeNewLead();
    const edited = { ...lead.plano_prospecao_7dias.find((d) => d.dia === 2)!, mensagem: "Minha mensagem editada manualmente.", is_custom_edited: true };
    lead.plano_prospecao_7dias = lead.plano_prospecao_7dias.map((d) => (d.dia === 2 ? edited : d));
    const onRefined = vi.fn();
    render(<Harness lead={lead} onRefined={onRefined} />);
    fireEvent.click(screen.getByText("Ver Plano"));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByText(/Atualizar Cópias/));

    await waitFor(() => expect(onRefined).toHaveBeenCalledTimes(1));
    expect(invokeSpy).not.toHaveBeenCalled();
    const refined: LeadProspeccao = onRefined.mock.calls[0][0];
    expect(refined.plano_prospecao_7dias).toHaveLength(7);
    expect(refined.plano_prospecao_7dias.find((d) => d.dia === 2)!.mensagem).toBe("Minha mensagem editada manualmente.");
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText("Minha mensagem editada manualmente.")).toBeTruthy();
  });

  it("lead antigo com foco nulo: Atualizar Cópias não lança erro", async () => {
    const onRefined = vi.fn();
    render(<Harness lead={makeLegacyLead()} onRefined={onRefined} />);
    fireEvent.click(screen.getByText("Ver Plano"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText(/Atualizar Cópias/));
    await waitFor(() => expect(onRefined).toHaveBeenCalledTimes(1));
  });

  it("copiar mensagem dentro do dialog copia o texto do dia; fechar o modal funciona", async () => {
    const lead = makeNewLead();
    render(<Harness lead={lead} />);
    fireEvent.click(screen.getByText("Ver Plano"));
    const dialog = await screen.findByRole("dialog");

    const day1 = lead.plano_prospecao_7dias.find((d) => d.dia === 1)!;
    const copyBtn = within(dialog).getAllByText("Mensagem:")[0].parentElement!.querySelector("button")!;
    fireEvent.click(copyBtn);
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(day1.mensagem));

    fireEvent.click(within(dialog).getByRole("button", { name: /close|fechar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Executar no SDR abre o modal do SDR com a mesma mensagem do dia do plano", async () => {
    const lead = makeNewLead();
    render(<Harness lead={lead} />);
    fireEvent.click(screen.getByText("Ver Plano"));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getAllByText("Executar no SDR")[1]); // Dia 2

    const day2 = lead.plano_prospecao_7dias.find((d) => d.dia === 2)!;
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).length).toBeGreaterThan(1));
    const textareas = Array.from(document.querySelectorAll("textarea")).map((t) => (t as HTMLTextAreaElement).value);
    expect(textareas).toContain(day2.mensagem);
    expect(generateSdrFirstApproachMessage({ lead, dayNumber: 2 }).text).toBe(day2.mensagem);
  });
});
