// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: { plan_name: "free", status: "active" },
    isAdmin: false,
    loading: false,
    error: null,
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
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));

const mockLeadsData = [
  {
    id: "lead-1",
    place_id: "place-1",
    nome: "Empresa Alfa",
    nicho: "Contabilidade",
    cidade: "Curitiba",
    telefone: "41999999999",
    website: "https://alfa.com.br",
    rating: 4.8,
    total_reviews: 45,
    probabilidade_conversao: 85, // >= 70 -> Potencial Alto
    sinais: { has_whatsapp_on_site: true, has_meta_pixel: true, has_gtag: true, has_gtm: false },
  },
  {
    id: "lead-2",
    place_id: "place-2",
    nome: "Empresa Beta",
    nicho: "Advocacia",
    cidade: "Curitiba",
    telefone: "41888888888",
    website: "https://beta.com.br",
    rating: 4.2,
    total_reviews: 20,
    probabilidade_conversao: 55, // >= 40 e < 70 -> Potencial Médio
    sinais: { has_whatsapp_on_site: true, has_meta_pixel: false, has_gtag: false, has_gtm: false },
  },
  {
    id: "lead-3",
    place_id: "place-3",
    nome: "Empresa Gama",
    nicho: "Odontologia",
    cidade: "Curitiba",
    telefone: "41777777777",
    website: null,
    rating: 3.9,
    total_reviews: 10,
    probabilidade_conversao: 25, // < 40 -> Potencial Básico
    sinais: { has_whatsapp_on_site: false, has_meta_pixel: false, has_gtag: false, has_gtm: false },
  },
  {
    id: "lead-4",
    place_id: "place-4",
    nome: "Empresa Delta",
    nicho: "Engenharia",
    cidade: "Curitiba",
    telefone: "41666666666",
    website: "https://delta.com.br",
    rating: 5.0,
    total_reviews: 12,
    probabilidade_conversao: 0, // 0 -> Gerar Plano / Análise
    sinais: { has_whatsapp_on_site: true, has_meta_pixel: true, has_gtag: false, has_gtm: false },
  },
];

let leadsToReturn: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve({ data: leadsToReturn, error: null })),
    }),
    functions: {
      invoke: vi.fn().mockImplementation(() => Promise.resolve({ data: { leads: leadsToReturn }, error: null })),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

import { LeadsList } from "./LeadsList";

describe("LeadsList · Hotfix cn is not defined e Renderização de Leads", () => {
  beforeEach(() => {
    toast.mockClear();
    leadsToReturn = [];
  });
  afterEach(cleanup);

  it("renderiza o estado inicial sem erros (zero leads)", async () => {
    leadsToReturn = [];
    render(
      <MemoryRouter>
        <LeadsList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Nenhum lead encontrado/i)).toBeDefined();
    });
    expect(screen.queryByText(/Potencial Alto/i)).toBeNull();
  });

  it("renderiza lista com múltiplos leads e calcula classes de potencial com cn sem ReferenceError", async () => {
    leadsToReturn = mockLeadsData;
    render(
      <MemoryRouter>
        <LeadsList />
      </MemoryRouter>
    );

    // Confirma que os quatro leads foram renderizados com seus nomes
    await waitFor(() => {
      expect(screen.getByText("Empresa Alfa")).toBeDefined();
      expect(screen.getByText("Empresa Beta")).toBeDefined();
      expect(screen.getByText("Empresa Gama")).toBeDefined();
      expect(screen.getByText("Empresa Delta")).toBeDefined();
    });

    // Valida que os badges de potencial calculados com `cn(...)` renderizaram perfeitamente sem ReferenceError
    expect(screen.getByText("Potencial Alto")).toBeDefined();
    expect(screen.getByText("Potencial Médio")).toBeDefined();
    expect(screen.getByText("Potencial Básico")).toBeDefined();
  });
});
