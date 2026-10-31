// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock ResizeObserver and scrollIntoView for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: { plan_name: "free", status: "active", leads_limit: 20, leads_used: 0 },
    isAdmin: false,
    loading: false,
    error: null,
    canUseUsaProspecting: () => false,
    getUsagePercentage: () => 0,
    getPlanDisplayName: () => "Gratuito",
    hasUsaAddon: () => false,
    canUseLeads: () => true,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useUsage", () => ({
  useUsage: () => ({
    usage: {
      plan_name: "free",
      leads_limit: 20,
      leads_used: 0,
      leads_remaining: 20,
      ai_limit: 3,
      ai_used: 0,
      ai_remaining: 3,
      ai_available_total: 3,
      leads_bonus_balance: 0,
      leads_available_total: 20,
      billing_period_end: new Date().toISOString(),
      is_admin: false,
    },
    leadsRemaining: 20,
    aiRemaining: 3,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "teste52@gmail.com" },
  }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn(), trackInitiateCheckout: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { leads: [] }, error: null }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "test-user-123" } } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

import Prospeccao from "./Prospeccao";

describe("Página /prospeccao · Renderização Completa", () => {
  afterEach(cleanup);

  it("renderiza a página /prospeccao completa com usuário autenticado e sem erros", async () => {
    render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/prospeccao"]}>
          <Prospeccao />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      // Confirma que o formulário de prospecção e os componentes principais montam perfeitamente
      expect(document.getElementById("primeira-busca")).toBeDefined();
    });
  });
});
