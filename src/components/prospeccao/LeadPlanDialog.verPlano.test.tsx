// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const updateSpy = vi.fn();
const invokeSpy = vi.fn();
const refineSpy = vi.fn();
let storedPlanPayload: unknown = null;

vi.mock("@/integrations/supabase/client", () => {
  let selectedCols = "";
  const chain: Record<string, unknown> = {
    select: (cols: string) => { selectedCols = cols; return chain; },
    update: (payload: unknown) => { updateSpy(payload); return chain; },
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => (selectedCols === "plano_prospeccao"
      ? { data: { plano_prospeccao: storedPlanPayload }, error: null }
      : { data: null, error: { message: "sem linha" } }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: (...a: unknown[]) => invokeSpy(...a) },
      auth: {
        getSession: async () => ({ data: { session: { access_token: "tok" } } }),
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
    },
  };
});
vi.mock("@/services/refineWithAI", () => ({
  refineWithAI: (...a: unknown[]) => refineSpy(...a),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ subscription: { plan_name: "pro", status: "active" }, loading: false, isAdmin: false }),
}));
vi.mock("@/hooks/useUsage", () => ({
  useUsage: () => ({ usage: { plan_name: "pro", ai_used: 0, ai_remaining: 5, ai_limit: 5 }, canAnalyzeAI: true, refetch: vi.fn(), isAdmin: false }),
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
import { SellerProfileDialog } from "@/components/profile/SellerProfileDialog";
import {
  configureSellerProfileStorage,
  loadSellerProfileForUser,
  resetSellerProfileStateForTests,
  saveSellerProfile,
} from "@/lib/sellerProfile";
import {
  COMPLETE_SELLER_PROFILE, FIXTURE_DAY1_TEXT, FIXTURE_DAY4_TEXT,
  makeGeminiPlanDays, makeLeadWithoutPlan, makeLegacyLead, makeNewLead,
} from "@/test/leadFixtures";
import type { LeadProspeccao } from "@/types/lead";

// Reproduz o contrato de LeadsList/LeadsSalvos: o botão "Ver Plano" seleciona o lead e abre o dialog.
const Harness = ({ lead, onRefined }: { lead: LeadProspeccao; onRefined?: (l: LeadProspeccao) => void }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LeadProspeccao | null>(null);
  return (
    <>
      <button onClick={() => { setSelected(lead); setOpen(true); }}>Ver Plano</button>
      <LeadPlanDialog lead={selected} open={open} onOpenChange={setOpen} onLeadRefined={onRefined} />
      <SellerProfileDialog />
    </>
  );
};

const setupProfile = async (profile: Record<string, string> | null) => {
  resetSellerProfileStateForTests();
  const memory = new Map<string, unknown>();
  configureSellerProfileStorage({
    load: async (id) => (memory.get(id) as never) ?? null,
    save: async (id, p) => { memory.set(id, p); },
  });
  await loadSellerProfileForUser("user-1");
  if (profile) await saveSellerProfile(profile);
};

const openPlan = async () => {
  fireEvent.click(screen.getByText("Ver Plano"));
  return screen.findByRole("dialog");
};

describe("Ver Plano → LeadPlanDialog (nenhuma abertura, cópia ou edição chama o Gemini)", () => {
  beforeEach(async () => {
    updateSpy.mockClear();
    invokeSpy.mockClear();
    refineSpy.mockReset();
    copyToClipboard.mockClear();
    storedPlanPayload = null;
    await setupProfile(COMPLETE_SELLER_PROFILE);
  });
  afterEach(cleanup);

  it.each([
    ["lead novo", makeNewLead],
    ["lead antigo", makeLegacyLead],
  ])("%s: clicar em Ver Plano abre o modal com diagnóstico e 7 dias, sem erro e sem IA", async (_n, make) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lead = make();
    render(<Harness lead={lead} />);
    const dialog = await openPlan();
    expect(within(dialog).getByText(lead.nome)).toBeTruthy();
    expect(within(dialog).getByText("Alinhamento Cadastral para Abordagem")).toBeTruthy();
    for (let d = 1; d <= 7; d++) expect(within(dialog).getByTestId(`dia-${d}`)).toBeTruthy();
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(refineSpy).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.filter((c) => String(c[0]).includes("ReferenceError"))).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("lead sem plano: mostra o estado vazio e NÃO gera nada sozinho", async () => {
    render(<Harness lead={makeLeadWithoutPlan()} />);
    const dialog = await openPlan();
    expect(within(dialog).getByText(/Analise premium de IA ainda nao gerada/)).toBeTruthy();
    expect(within(dialog).queryByText("Mensagem:")).toBeNull();
    expect(refineSpy).not.toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("lead antigo: a mensagem de cada dia é exibida exatamente como salva (histórico preservado)", async () => {
    const lead = makeLegacyLead();
    render(<Harness lead={lead} />);
    const dialog = await openPlan();
    for (const d of lead.plano_prospecao_7dias) expect(within(dialog).getByText(d.mensagem)).toBeTruthy();
  });

  it("copiar mensagem copia o texto salvo; fechar o modal funciona; nada chama o Gemini", async () => {
    render(<Harness lead={makeNewLead()} />);
    const dialog = await openPlan();
    const copyBtn = within(dialog).getAllByText("Mensagem:")[0].parentElement!.querySelector("button")!;
    fireEvent.click(copyBtn);
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(FIXTURE_DAY1_TEXT));

    fireEvent.click(within(dialog).getByRole("button", { name: /close|fechar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(refineSpy).not.toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("Executar no SDR abre o SDR com EXATAMENTE o texto salvo do dia, sem gerar nada", async () => {
    render(<Harness lead={makeNewLead()} />);
    const dialog = await openPlan();

    fireEvent.click(within(dialog).getAllByText("Executar no SDR")[1]); // Dia 4

    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).length).toBeGreaterThan(1));
    const values = () => Array.from(document.querySelectorAll("textarea")).map((t) => (t as HTMLTextAreaElement).value);
    await waitFor(() => expect(values()).toContain(FIXTURE_DAY4_TEXT));
    expect(refineSpy).not.toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("no SDR, dia sem mensagem não oferece editor nem envio", async () => {
    render(<Harness lead={makeNewLead()} />);
    const dialog = await openPlan();
    fireEvent.click(within(dialog).getAllByText("Executar no SDR")[0]);
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).length).toBeGreaterThan(1));

    fireEvent.click(await screen.findByRole("button", { name: /Dia 3/ }));
    expect(await screen.findByTestId("sdr-no-message")).toBeTruthy();
    expect(screen.queryByText("Salvar no Plano")).toBeNull();
    expect(screen.queryByText(/Mensagem do Dia 3/)).toBeNull();
    expect(screen.queryByText(/Abrir no meu WhatsApp/)).toBeNull();
  });

  it("editar no SDR e salvar grava SÓ o dia editado, como edição manual, preservando o restante do plano salvo", async () => {
    const days = makeGeminiPlanDays();
    storedPlanPayload = { plano_prospeccao_7dias: days, diagnostico: { observado: ["x"] }, history: [{ saved_at: "antes" }], prompt_version: "v5" };
    render(<Harness lead={makeNewLead()} />);
    const dialog = await openPlan();
    fireEvent.click(within(dialog).getAllByText("Executar no SDR")[0]); // Dia 1

    const textarea = await waitFor(() => {
      const el = Array.from(document.querySelectorAll("textarea")).find((t) => (t as HTMLTextAreaElement).value === FIXTURE_DAY1_TEXT);
      if (!el) throw new Error("textarea não encontrada");
      return el as HTMLTextAreaElement;
    });
    fireEvent.change(textarea, { target: { value: "Minha versão editada do Dia 1." } });
    fireEvent.click(await screen.findByText("Salvar no Plano"));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const saved = updateSpy.mock.calls[0][0].plano_prospeccao as { plano_prospeccao_7dias: Array<Record<string, unknown>>; history: unknown[]; diagnostico: unknown };
    expect(saved.history).toEqual([{ saved_at: "antes" }]);
    expect(saved.diagnostico).toEqual({ observado: ["x"] });
    const [d1, ...rest] = saved.plano_prospeccao_7dias;
    expect(d1).toMatchObject({ dia: 1, mensagem: "Minha versão editada do Dia 1.", is_custom_edited: true });
    expect(rest).toEqual(days.slice(1)); // nenhum outro dia foi tocado ou regenerado
    expect(refineSpy).not.toHaveBeenCalled();
  });
});

describe("Gerar análise/nova versão: somente por ação explícita, com perfil e confirmação", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    invokeSpy.mockClear();
    refineSpy.mockReset();
    refineSpy.mockResolvedValue({ data: { plano_prospeccao_7dias: makeGeminiPlanDays(), diagnostico_bullets: ["ok"] }, requestId: "r" });
    storedPlanPayload = null;
  });
  afterEach(cleanup);

  it("sem perfil comercial: abre o formulário e NÃO chama a IA", async () => {
    await setupProfile(null);
    render(<Harness lead={makeLeadWithoutPlan()} />);
    const dialog = await openPlan();
    fireEvent.click(within(dialog).getByText("Gerar análise com IA"));
    expect(await screen.findByText("Seu perfil comercial")).toBeTruthy();
    expect(refineSpy).not.toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("perfil incompleto (serviço genérico, sem descrição concreta) também bloqueia", async () => {
    await setupProfile({ display_name: "Ana", company_name: "", service_offered: "Tráfego", offer_description: "tráfego", target_audience: "" });
    render(<Harness lead={makeLeadWithoutPlan()} />);
    const dialog = await openPlan();
    fireEvent.click(within(dialog).getByText("Gerar análise com IA"));
    expect(await screen.findByText("Seu perfil comercial")).toBeTruthy();
    expect(refineSpy).not.toHaveBeenCalled();
  });

  it("lead sem plano e com perfil: gera uma vez, sem pedir confirmação de substituição", async () => {
    await setupProfile(COMPLETE_SELLER_PROFILE);
    render(<Harness lead={makeLeadWithoutPlan()} />);
    const dialog = await openPlan();
    fireEvent.click(within(dialog).getByText("Gerar análise com IA"));
    await waitFor(() => expect(refineSpy).toHaveBeenCalledTimes(1));
    expect(refineSpy.mock.calls[0][0]).toMatchObject({ replace_existing: false });
    // Campos que a Edge Function ANTIGA lê continuam sendo enviados (compatibilidade na transição)
    const sent = refineSpy.mock.calls[0][0] as Record<string, unknown>;
    for (const key of ["leadId", "lead_id", "lead", "search_context", "analysis_context", "foco", "nome", "cidade", "nicho"]) {
      expect(sent).toHaveProperty(key);
    }
  });

  it("lead com plano: pede confirmação; cancelar não chama IA; confirmar chama uma vez pedindo substituição", async () => {
    await setupProfile(COMPLETE_SELLER_PROFILE);
    render(<Harness lead={makeNewLead()} />);
    const dialog = await openPlan();

    fireEvent.click(within(dialog).getByText("Gerar nova versão com IA"));
    expect(await screen.findByText("Gerar uma nova versão do plano?")).toBeTruthy();
    expect(screen.getByText(/A versão atual fica guardada no histórico/)).toBeTruthy();
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.queryByText("Gerar uma nova versão do plano?")).toBeNull());
    expect(refineSpy).not.toHaveBeenCalled();

    fireEvent.click(within(await screen.findByRole("dialog")).getByText("Gerar nova versão com IA"));
    fireEvent.click(await screen.findByRole("button", { name: "Gerar nova versão" }));
    await waitFor(() => expect(refineSpy).toHaveBeenCalledTimes(1));
    expect(refineSpy.mock.calls[0][0]).toMatchObject({ replace_existing: true });
  });
});
