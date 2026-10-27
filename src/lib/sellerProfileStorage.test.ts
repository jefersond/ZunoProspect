// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeSellerProfileDialog,
  ensureSellerProfileOrPrompt,
  getSellerProfileForRequest,
  getSellerProfileState,
  loadSellerProfileForUser,
  localSellerProfileStorage,
  resetSellerProfileStateForTests,
  saveSellerProfile,
  configureSellerProfileStorage,
  type SellerProfileStorage,
} from "./sellerProfile";

const profileA = {
  display_name: "Ana Souza", company_name: "Souza Digital",
  service_offered: "Gestão de Instagram para restaurantes",
  offer_description: "Cuido do Instagram de restaurantes: fotos dos pratos, cardápio nos destaques e 12 posts por mês.",
  target_audience: "",
};
const profileB = { ...profileA, display_name: "Bruno Lima", service_offered: "Criação de sites", offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas." };

describe("perfil comercial em localStorage (navegador compartilhado)", () => {
  beforeEach(() => { localStorage.clear(); resetSellerProfileStateForTests(); });
  afterEach(() => { vi.restoreAllMocks(); closeSellerProfileDialog(); });

  it("não vaza entre usuários do mesmo navegador", async () => {
    await loadSellerProfileForUser("user-a");
    await saveSellerProfile(profileA);
    expect(getSellerProfileForRequest()?.display_name).toBe("Ana Souza");

    await loadSellerProfileForUser("user-b");
    expect(getSellerProfileForRequest()).toBeNull();
    expect(getSellerProfileState().profile.display_name).toBe("");

    await saveSellerProfile(profileB);
    await loadSellerProfileForUser("user-a");
    expect(getSellerProfileForRequest()?.display_name).toBe("Ana Souza");
    await loadSellerProfileForUser("user-b");
    expect(getSellerProfileForRequest()?.display_name).toBe("Bruno Lima");

    // chaves separadas por usuário
    expect(Object.keys(localStorage).filter((k) => k.startsWith("zuno_seller_profile_v1:")).sort()).toEqual([
      "zuno_seller_profile_v1:user-a", "zuno_seller_profile_v1:user-b",
    ]);
  });

  it("logout limpa o perfil em memória e fecha o formulário", async () => {
    await loadSellerProfileForUser("user-a");
    await saveSellerProfile(profileA);
    await loadSellerProfileForUser(null);
    expect(getSellerProfileForRequest()).toBeNull();
    expect(getSellerProfileState()).toMatchObject({ userId: null, loaded: true, dialogOpen: false });
    await expect(saveSellerProfile(profileA)).rejects.toThrow(/Entre na sua conta/);
  });

  it("durante a carga de outro usuário o perfil do anterior já não está acessível", async () => {
    await loadSellerProfileForUser("user-a");
    await saveSellerProfile(profileA);

    let release!: () => void;
    const slow: SellerProfileStorage = {
      load: () => new Promise((resolve) => { release = () => resolve(null); }),
      save: async () => undefined,
    };
    configureSellerProfileStorage(slow);
    const pending = loadSellerProfileForUser("user-b");
    expect(getSellerProfileForRequest()).toBeNull(); // janela da corrida
    release();
    await pending;
    expect(getSellerProfileForRequest()).toBeNull();
  });

  it("leitura atrasada de um usuário antigo não sobrescreve o usuário atual", async () => {
    const resolvers: Record<string, (v: unknown) => void> = {};
    configureSellerProfileStorage({
      load: (id) => new Promise((resolve) => { resolvers[id] = resolve as never; }),
      save: async () => undefined,
    });
    const first = loadSellerProfileForUser("user-a");
    const second = loadSellerProfileForUser("user-b");
    resolvers["user-b"](profileB);
    await second;
    resolvers["user-a"](profileA); // chega depois
    await first;
    expect(getSellerProfileState().userId).toBe("user-b");
    expect(getSellerProfileForRequest()?.display_name).toBe("Bruno Lima");
  });

  it("ausência de perfil não gera erro: apenas pede o preenchimento", async () => {
    await loadSellerProfileForUser("user-novo");
    expect(getSellerProfileForRequest()).toBeNull();
    expect(() => ensureSellerProfileOrPrompt()).not.toThrow();
    expect(getSellerProfileState().dialogOpen).toBe(true);
  });

  it("JSON corrompido ou valor de outro formato vira 'sem perfil', sem exceção", async () => {
    localStorage.setItem("zuno_seller_profile_v1:user-a", "{não é json");
    await expect(localSellerProfileStorage.load("user-a")).resolves.toBeNull();
    localStorage.setItem("zuno_seller_profile_v1:user-a", JSON.stringify(["x"]));
    await loadSellerProfileForUser("user-a");
    expect(getSellerProfileForRequest()).toBeNull();
  });

  it("localStorage indisponível (modo privado/bloqueado): carrega vazio e salvar avisa com mensagem clara", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    await expect(loadSellerProfileForUser("user-a")).resolves.toBeUndefined();
    expect(getSellerProfileForRequest()).toBeNull();
    await expect(saveSellerProfile(profileA)).rejects.toThrow(/Não foi possível salvar o perfil neste navegador/);
  });

  it("perfil salvo é sanitizado e limitado antes de ser gravado", async () => {
    await loadSellerProfileForUser("user-a");
    const saved = await saveSellerProfile({ ...profileA, display_name: "  Ana\u0000    Souza  ", offer_description: "y".repeat(2000) });
    expect(saved.display_name).toBe("Ana Souza");
    expect(saved.offer_description).toHaveLength(600);
    expect(JSON.parse(localStorage.getItem("zuno_seller_profile_v1:user-a") as string).offer_description).toHaveLength(600);
  });
});
