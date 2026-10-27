// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { SellerProfileDialog } from "./SellerProfileDialog";
import { SellerProfileInvite } from "./SellerProfileInvite";
import {
  configureSellerProfileStorage,
  ensureSellerProfileOrPrompt,
  getSellerProfileForRequest,
  loadSellerProfileForUser,
  openSellerProfileDialog,
  resetSellerProfileStateForTests,
  type SellerProfileStorage,
} from "@/lib/sellerProfile";

const COMPLETE = {
  display_name: "Ana", company_name: "", service_category: "sites" as const, service_offered: "Sites para oficinas",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas.", target_audience: "",
};

describe("convite e formulário do perfil comercial", () => {
  beforeEach(() => { toast.mockClear(); sessionStorage.clear(); localStorage.clear(); resetSellerProfileStateForTests(); });
  afterEach(cleanup);

  it("usuário sem perfil vê o convite discreto; dispensar some nesta visita; não bloqueia nada", async () => {
    await loadSellerProfileForUser("u1");
    render(<SellerProfileInvite />);
    expect(screen.getByTestId("seller-profile-invite")).toBeTruthy();
    fireEvent.click(screen.getByText("Agora não"));
    expect(screen.queryByTestId("seller-profile-invite")).toBeNull();
  });

  it("sem usuário ou com perfil completo, não há convite", async () => {
    await loadSellerProfileForUser(null);
    const { unmount } = render(<SellerProfileInvite />);
    expect(screen.queryByTestId("seller-profile-invite")).toBeNull();
    unmount();
    configureSellerProfileStorage({ load: async () => COMPLETE, save: async (_i, p) => p });
    await loadSellerProfileForUser("u1");
    render(<SellerProfileInvite />);
    expect(screen.queryByTestId("seller-profile-invite")).toBeNull();
  });

  it("formulário mostra as 9 categorias e exige a categoria escolhida", async () => {
    await loadSellerProfileForUser("u1");
    openSellerProfileDialog();
    render(<SellerProfileDialog />);
    const select = (await screen.findByRole("dialog")).querySelector("#seller-category") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(["trafego", "social_media", "sites", "crm", "automacao", "seo", "design", "full_service", "outro"]);
    fireEvent.click(screen.getByText("Salvar perfil"));
    expect(await screen.findAllByText(/obrigatório/i)).not.toHaveLength(0);
  });

  it("falha ao salvar no banco: informa o erro, mantém o formulário e a análise continua bloqueada", async () => {
    const storage: SellerProfileStorage = { load: async () => null, save: async () => { throw new Error("Não foi possível salvar seu perfil comercial: rede"); } };
    configureSellerProfileStorage(storage);
    await loadSellerProfileForUser("u1");
    openSellerProfileDialog();
    render(<SellerProfileDialog />);
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(dlg.querySelector("#seller-display-name")!, { target: { value: "Ana" } });
    fireEvent.change(dlg.querySelector("#seller-category")!, { target: { value: "sites" } });
    fireEvent.change(dlg.querySelector("#seller-service")!, { target: { value: "Sites para oficinas" } });
    fireEvent.change(dlg.querySelector("#seller-offer")!, { target: { value: COMPLETE.offer_description } });
    fireEvent.click(screen.getByText("Salvar perfil"));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", title: "Não foi possível salvar", description: expect.stringMatching(/rede/) })));
    expect(getSellerProfileForRequest()).toBeNull();
    expect(ensureSellerProfileOrPrompt()).toBe(false); // nenhuma análise é solicitada
  });

  it("erro ao ler o perfil salvo é exibido no formulário", async () => {
    configureSellerProfileStorage({ load: async () => { throw new Error("Não foi possível carregar seu perfil comercial: x"); }, save: async (_i, p) => p });
    await loadSellerProfileForUser("u1");
    openSellerProfileDialog();
    render(<SellerProfileDialog />);
    expect((await screen.findByTestId("seller-profile-load-error")).textContent).toMatch(/carregar/);
  });
});
