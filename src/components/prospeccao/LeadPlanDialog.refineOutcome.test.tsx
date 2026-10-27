// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const toast = vi.fn();
const refineWithAI = vi.fn();
let dbRow: Record<string, unknown> | null = null;

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/services/refineWithAI", () => ({ refineWithAI: (...a: unknown[]) => refineWithAI(...a) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    update: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: dbRow, error: dbRow ? null : new Error("not found") }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: vi.fn() },
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
        getSession: async () => ({ data: { session: { access_token: "token" } } }),
      },
    },
  };
});
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ subscription: { plan_name: "pro", status: "active" }, loading: false, isAdmin: false }),
}));
vi.mock("@/hooks/useUsage", () => ({
  useUsage: () => ({ usage: { plan_name: "pro", ai_used: 0, ai_limit: 50, ai_remaining: 50 }, canAnalyzeAI: true, refetch: vi.fn(), isAdmin: false }),
}));
vi.mock("@/components/templates/TemplateSelector", () => ({ TemplateSelector: () => null }));
vi.mock("@/components/profile/UpgradePlanDialog", () => ({ UpgradePlanDialog: () => null }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));
vi.mock("@/utils/subscriptionUtils", async (orig) => ({ ...(await orig<object>()), canUsePaidFeatures: () => true }));

import { LeadPlanDialog } from "./LeadPlanDialog";
import { makeNewLead } from "@/test/leadFixtures";
import { normalizeRefineError } from "@/lib/refineObservability";
import type { LeadProspeccao } from "@/types/lead";

const GENERIC = "Atuo com Tráfego e queria te fazer uma pergunta rápida: hoje a entrada de novos clientes acontece de forma constante";

const renderDialog = (lead: LeadProspeccao, onLeadRefined = vi.fn()) => {
  render(<LeadPlanDialog lead={lead} open onOpenChange={() => undefined} onLeadRefined={onLeadRefined} />);
  return onLeadRefined;
};

const clickRefine = async () => {
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getAllByText("Refinar com IA")[0].closest("button") as HTMLButtonElement);
};

const geminiRow = (lead: LeadProspeccao) => ({
  diagnostico_bullets: ["Resumo gerado pelo Gemini sobre a empresa.", "Sinal observado específico.", "Hipótese comercial honesta."],
  probabilidade_conversao: 64,
  ai_analise_gerada_em: "2026-10-27T12:00:00Z",
  ai_used_fallback: false,
  ai_fallback_reason: null,
  plano_prospeccao: { plano_prospeccao_7dias: lead.plano_prospecao_7dias.map((d) => ({ ...d, mensagem: `Mensagem Gemini dia ${d.dia}` })) },
});

describe("Refinar com IA: só anuncia sucesso quando há análise válida e visível", () => {
  beforeEach(() => {
    toast.mockClear();
    refineWithAI.mockReset();
    dbRow = null;
  });
  afterEach(cleanup);

  it("HTTP 200 com texto de reserva: NÃO mostra 'Análise atualizada', sinaliza reserva e mostra o que está salvo", async () => {
    const lead = makeNewLead();
    dbRow = {
      ...geminiRow(lead),
      diagnostico_bullets: ["Empresa atua no segmento.", "Sinais observados genéricos.", "Possibilidade comercial genérica."],
      ai_used_fallback: true,
      ai_fallback_reason: "gemini-3.1-flash-lite:400",
      plano_prospeccao: { plano_prospeccao_7dias: lead.plano_prospecao_7dias.map((d) => ({ ...d, mensagem: `${GENERIC} (${d.dia})` })) },
    };
    refineWithAI.mockResolvedValue({
      requestId: "r1",
      data: { success: true, used_fallback: true, model: "contextual-fallback", fallback_reason: "gemini-3.1-flash-lite:400" },
    });
    const onRefined = renderDialog(lead);
    await clickRefine();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const titles = toast.mock.calls.map((c) => c[0].title);
    expect(titles).not.toContain("Análise atualizada");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", title: "A IA não gerou a análise" }));
    expect(String(toast.mock.calls[0][0].description)).toMatch(/genérico de reserva/i);

    // a tela reflete o que foi realmente salvo, com o aviso de reserva, em vez de fingir uma análise de IA
    await waitFor(() => expect(screen.getByText("Texto de reserva: não foi gerado pela IA")).toBeTruthy());
    expect(screen.queryByText("Gerado pelo Gemini")).toBeNull();
    expect(onRefined).toHaveBeenCalledWith(expect.objectContaining({ ai_used_fallback: true }));
  });

  it("HTTP 200 com success:false: erro claro e a análise existente permanece intocada", async () => {
    const lead = makeNewLead();
    const firstMessage = lead.plano_prospecao_7dias[0].mensagem;
    refineWithAI.mockResolvedValue({ requestId: "r2", data: { success: false, error_code: "REFINE_PROVIDER_UNAVAILABLE" } });
    const onRefined = renderDialog(lead);
    await clickRefine();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls.map((c) => c[0].title)).not.toContain("Análise atualizada");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(onRefined).not.toHaveBeenCalled();
    const shown = Array.from(document.querySelectorAll("p.whitespace-pre-wrap")).map((n) => n.textContent);
    expect(shown).toContain(firstMessage);
  });

  it("falha 502 do backend corrigido: mostra a mensagem do servidor e não atualiza o lead", async () => {
    const lead = makeNewLead();
    const { buildRefineOutcomeError } = await import("@/utils/refineOutcome");
    refineWithAI.mockRejectedValue(buildRefineOutcomeError({ kind: "failed", model: null, reason: "x" }, "r3"));
    const onRefined = renderDialog(lead);
    await clickRefine();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls.map((c) => c[0].title)).not.toContain("Análise atualizada");
    expect(onRefined).not.toHaveBeenCalled();
  });

  it("análise do Gemini: 'Análise atualizada', badge 'Gerado pelo Gemini' e mensagens novas visíveis", async () => {
    const lead = makeNewLead();
    dbRow = geminiRow(lead);
    refineWithAI.mockResolvedValue({ requestId: "r4", data: { success: true, model: "gemini-3.6-flash", used_fallback: false } });
    const onRefined = renderDialog(lead);
    await clickRefine();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Análise atualizada" })));
    await waitFor(() => expect(screen.getByText("Gerado pelo Gemini")).toBeTruthy());
    expect(screen.getByText("Mensagem Gemini dia 1")).toBeTruthy();
    expect(screen.queryByText("Texto de reserva: não foi gerado pela IA")).toBeNull();
    expect(onRefined).toHaveBeenCalledWith(expect.objectContaining({ ai_used_fallback: false }));
  });

  it("falha ao gravar no banco (503 REFINE_SAVE_FAILED): nenhum sucesso falso e a análise anterior segue na tela", async () => {
    const lead = makeNewLead();
    const body = {
      success: false,
      request_id: "r5",
      error_code: "REFINE_SAVE_FAILED",
      retryable: true,
      safe_message: "A análise foi gerada, mas não pôde ser salva. Seu crédito não foi consumido.",
    };
    const failure = await normalizeRefineError(
      { message: "non-2xx", context: new Response(JSON.stringify(body), { status: 503, headers: { "Content-Type": "application/json" } }) },
      "r5",
    );
    refineWithAI.mockRejectedValue(failure);
    const onRefined = renderDialog(lead);
    await clickRefine();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls.map((c) => c[0].title)).not.toContain("Análise atualizada");
    expect(onRefined).not.toHaveBeenCalled();
    const shown = Array.from(document.querySelectorAll("p.whitespace-pre-wrap")).map((n) => n.textContent);
    expect(shown).toContain(lead.plano_prospecao_7dias[0].mensagem);
  });

  it("clique duplo enquanto gera: uma única solicitação ao backend", async () => {
    const lead = makeNewLead();
    let resolveRefine: (v: unknown) => void = () => undefined;
    refineWithAI.mockImplementation(() => new Promise((resolve) => { resolveRefine = resolve; }));
    renderDialog(lead);
    const dialog = await screen.findByRole("dialog");
    const button = within(dialog).getAllByText("Refinar com IA")[0].closest("button") as HTMLButtonElement;

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(refineWithAI).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByText("Refinando...")).toBeTruthy();

    dbRow = geminiRow(lead);
    resolveRefine({ requestId: "r6", data: { success: true, model: "gemini-3.6-flash", used_fallback: false } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Análise atualizada" })));
    expect(refineWithAI).toHaveBeenCalledTimes(1);
  });

  it("análise do Gemini já salva: refinar de novo exige confirmação com aviso de crédito; cancelar não chama o backend", async () => {
    const lead = { ...makeNewLead(), ai_used_fallback: false, ai_analise_gerada_em: "2026-10-27T11:48:00Z" } as LeadProspeccao;
    renderDialog(lead);
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByTestId("refined-at").textContent).toMatch(/Análise atualizada · último refinamento em 27\/10\/2026/);
    fireEvent.click(within(dialog).getByText("Refinar novamente").closest("button") as HTMLButtonElement);

    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/consome 1 análise de IA/i)).toBeTruthy();
    expect(within(confirm).getByText(/Atualizar a página não consome créditos/i)).toBeTruthy();
    expect(refineWithAI).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByText("Cancelar"));
    expect(refineWithAI).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByText("Refinar novamente").closest("button") as HTMLButtonElement);
    dbRow = geminiRow(lead);
    refineWithAI.mockResolvedValue({ requestId: "r7", data: { success: true, model: "gemini-3.6-flash", used_fallback: false } });
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByText("Gerar nova análise (1 crédito)"));
    await waitFor(() => expect(refineWithAI).toHaveBeenCalledTimes(1));
  });

  it("lead antigo (análise sem origem registrada): compatível, sem selo, sem confirmação extra", async () => {
    const lead = { ...makeNewLead(), ai_analise_gerada_em: "2026-07-01T10:00:00Z" } as LeadProspeccao;
    renderDialog(lead);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByTestId("refined-at")).toBeNull();
    expect(within(dialog).queryByText("Texto de reserva: não foi gerado pela IA")).toBeNull();
    dbRow = geminiRow(lead);
    refineWithAI.mockResolvedValue({ requestId: "r8", data: { success: true, model: "gemini-3.6-flash", used_fallback: false } });
    fireEvent.click(within(dialog).getAllByText("Refinar com IA")[0].closest("button") as HTMLButtonElement);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(refineWithAI).toHaveBeenCalledTimes(1));
  });
});
