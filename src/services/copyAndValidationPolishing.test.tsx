// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mocks
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: {
      plan_name: "starter",
      subscription_status: "trialing",
      status: "trialing",
      leads_limit: 300,
      leads_used: 0,
      leads_remaining: 300,
      ai_limit: 30,
      ai_used: 0,
      ai_remaining: 30,
      trial_start: new Date().toISOString(),
      trial_end: new Date(Date.now() + 7 * 86400000).toISOString(),
      trial_days_remaining: 7,
    },
    isAdmin: false,
    loading: false,
    error: null,
    canUseUsaProspecting: () => false,
    getUsagePercentage: () => 0,
    getPlanDisplayName: () => "Starter",
    hasUsaAddon: () => false,
    canUseLeads: () => true,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUsage", () => ({
  useUsage: () => ({
    usage: {
      plan_name: "starter",
      leads_limit: 300,
      leads_used: 0,
      leads_remaining: 300,
      ai_limit: 30,
      ai_used: 0,
      ai_remaining: 30,
      ai_available_total: 30,
      leads_bonus_balance: 0,
      leads_available_total: 300,
      is_admin: false,
    },
    leadsRemaining: 300,
    aiRemaining: 30,
    leadsAvailableTotal: 300,
    canSearchLeads: true,
    loading: false,
    error: null,
    isAdmin: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "teste@zunopropect.com.br" },
    loading: false,
    session: { user: { id: "test-user-123" }, access_token: "fake" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBillingOfferConfig", () => ({
  useBillingOfferConfig: () => ({
    trialDurationDays: 7,
    defaultNewBillingProvider: "stripe",
    introOffer: { enabled: false, eligible: false, plans: {} },
    loading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn(() => chain),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: { leads: [] }, error: null }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "test-user-123" } } } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
  };
});

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn(), trackInitiateCheckout: vi.fn() }));

import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { TrialActivationPanel } from "@/components/subscription/TrialActivationPanel";
import { ParaQuemSection } from "@/components/landing/ParaQuemSection";
import { HeroSection } from "@/components/landing/HeroSection";

describe("Polimento Final de Português e Copy — Testes de Conformidade", () => {
  afterEach(cleanup);

  it("valida mensagens amigáveis em português na tela de prospecção sem 'Required'", async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <ProspeccaoForm />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Clica no botão de busca com campos em branco
    const submitBtn = screen.getByRole("button", { name: /buscar leads/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Confirma que os erros exibidos são em português brasileiro
      expect(screen.getAllByText("Selecione um estado").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Selecione o foco comercial").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Informe a cidade")).toBeDefined();
      expect(screen.getByText("Informe o nicho")).toBeDefined();
      // Garante que NENHUM erro genérico em inglês "Required" foi renderizado
      expect(screen.queryByText(/^Required$/i)).toBeNull();
    });
  });

  it("não exibe o selo 'EUA: complemento' quando o país selecionado é Brasil", () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <ProspeccaoForm />
        </MemoryRouter>
      </TooltipProvider>
    );

    // O label de País deve existir
    expect(screen.getByText("País")).toBeDefined();
    // O badge "EUA: complemento" NÃO deve ser exibido quando Brasil é o padrão
    expect(screen.queryByText(/EUA: complemento/i)).toBeNull();
  });

  it("renderiza '30 análises de IA disponíveis' e '300 leads disponíveis' no indicador de uso", () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <UsageIndicator compact />
        </MemoryRouter>
      </TooltipProvider>
    );

    expect(screen.getByText("300 leads disponíveis")).toBeDefined();
    expect(screen.getByText("30 análises de IA disponíveis")).toBeDefined();
  });

  it("renderiza 'Resultados encontrados no teste gratuito' e 'Período gratuito ativo' no painel de ativação", () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <TrialActivationPanel
            subscription={{
              id: "sub-1",
              plan_name: "starter",
              subscription_status: "trialing",
              status: "trialing",
              trial_start: new Date().toISOString(),
              trial_end: new Date(Date.now() + 7 * 86400000).toISOString(),
              trial_days_remaining: 7,
            }}
            loading={false}
            error={null}
          />
        </MemoryRouter>
      </TooltipProvider>
    );

    expect(screen.getByText("Período gratuito ativo")).toBeDefined();
    expect(screen.getByText("Resultados encontrados no teste gratuito")).toBeDefined();
  });

  it("posiciona a Zuno para agências, consultores e autônomos na Landing Page, preservando a proposta central", () => {
    const { container: heroContainer } = render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    // Proposta central inalterada
    expect(heroContainer.textContent).toContain("Pare de procurar empresas no escuro.");
    expect(heroContainer.textContent).toContain("Comece a prospectar com direção.");
    // Posicionamento amplo B2B
    expect(heroContainer.textContent).toContain("Para agências, consultores, prestadores de serviços e autônomos");

    const { container: paraQuemContainer } = render(
      <MemoryRouter>
        <ParaQuemSection />
      </MemoryRouter>
    );

    // Substituição de 'Freelancers' isolado por 'Freelancers e profissionais autônomos'
    expect(paraQuemContainer.textContent).toContain("Freelancers e profissionais autônomos");
  });
});
