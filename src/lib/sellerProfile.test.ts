import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeSellerProfileDialog,
  configureSellerProfileStorage,
  createMigratingSellerProfileStorage,
  createRemoteSellerProfileStorage,
  ensureSellerProfileOrPrompt,
  getSellerProfileForRequest,
  getSellerProfileState,
  loadSellerProfileForUser,
  resetSellerProfileStateForTests,
  saveSellerProfile,
  type SellerProfileStorage,
} from "./sellerProfile";

const complete = {
  display_name: "Marina Costa",
  company_name: "Costa Digital",
  service_category: "sites" as const,
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "",
};

const memoryStorage = () => {
  const data = new Map<string, unknown>();
  const storage: SellerProfileStorage = {
    load: async (id) => (data.get(id) as never) ?? null,
    save: vi.fn(async (id, p) => { data.set(id, p); return p; }),
  };
  return { data, storage };
};

describe("perfil comercial do assinante", () => {
  beforeEach(() => resetSellerProfileStateForTests());

  it("sem perfil: ensure abre o formulário e retorna false (nada é enviado à IA)", () => {
    expect(getSellerProfileForRequest()).toBeNull();
    expect(ensureSellerProfileOrPrompt()).toBe(false);
    expect(getSellerProfileState().dialogOpen).toBe(true);
    closeSellerProfileDialog();
  });

  it("não assume serviço: perfil sem descrição concreta continua bloqueado", async () => {
    const { storage } = memoryStorage();
    configureSellerProfileStorage(storage);
    await loadSellerProfileForUser("u1");
    await saveSellerProfile({ ...complete, offer_description: "tráfego" });
    expect(getSellerProfileForRequest()).toBeNull();
  });

  it("salva e recarrega isolado por usuário", async () => {
    const { storage, data } = memoryStorage();
    configureSellerProfileStorage(storage);
    await loadSellerProfileForUser("u1");
    await saveSellerProfile(complete);
    expect(getSellerProfileForRequest()).toMatchObject({ display_name: "Marina Costa" });
    expect(data.has("u1")).toBe(true);

    await loadSellerProfileForUser("u2");
    expect(getSellerProfileForRequest()).toBeNull();
    await loadSellerProfileForUser("u1");
    expect(getSellerProfileForRequest()?.service_offered).toBe(complete.service_offered);
  });

  it("sanitiza ao salvar e exige usuário logado", async () => {
    const { storage } = memoryStorage();
    configureSellerProfileStorage(storage);
    await expect(saveSellerProfile(complete)).rejects.toThrow(/Entre na sua conta/);
    await loadSellerProfileForUser("u1");
    const saved = await saveSellerProfile({ ...complete, display_name: "  Marina\u0000   Costa  " });
    expect(saved.display_name).toBe("Marina Costa");
  });

  it("adapter remoto: upsert por user_id devolve o que o banco confirmou; leitura sanitizada", async () => {
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { ...complete, user_id: "u1", extra: "x" }, error: null }) }) }));
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...complete, user_id: "u1", extra: "x" }, error: null }) }) }),
        upsert,
      }),
    };
    const remote = createRemoteSellerProfileStorage(client as never);
    const saved = await remote.save("u1", { ...complete });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", display_name: "Marina Costa", service_category: "sites" }), { onConflict: "user_id" });
    expect(saved).toEqual(complete);
    expect(await remote.load("u1")).toEqual(complete);
  });

  it("falha do banco ao salvar: lança e o estado não muda", async () => {
    const client = { from: () => ({ upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "boom" } }) }) }) }) };
    configureSellerProfileStorage(createRemoteSellerProfileStorage(client as never));
    await loadSellerProfileForUser("u1").catch(() => undefined);
    await expect(saveSellerProfile(complete)).rejects.toThrow(/Não foi possível salvar seu perfil comercial/);
    expect(getSellerProfileForRequest()).toBeNull();
  });

  it("erro de leitura remota é exposto e não dispara migração", async () => {
    const remote: SellerProfileStorage = { load: async () => { throw new Error("rede"); }, save: vi.fn(), saveIfAbsent: vi.fn() };
    const local: SellerProfileStorage = { load: async () => ({ ...complete }), save: vi.fn() };
    configureSellerProfileStorage(createMigratingSellerProfileStorage(remote, local));
    await loadSellerProfileForUser("u1");
    expect(getSellerProfileState().loadError).toMatch(/rede/);
    expect(remote.saveIfAbsent).not.toHaveBeenCalled();
  });

  it("perfil sincronizado entre sessões: segunda sessão lê o que a primeira salvou", async () => {
    const { storage } = memoryStorage();
    configureSellerProfileStorage(storage);
    await loadSellerProfileForUser("u1");
    await saveSellerProfile(complete);
    resetSellerProfileStateForTests();
    configureSellerProfileStorage(storage); // "outro aparelho", mesmo banco
    await loadSellerProfileForUser("u1");
    expect(getSellerProfileForRequest()?.service_category).toBe("sites");
  });

  it("migração: perfil que só existe no navegador sobe uma vez e nunca sobrescreve o banco", async () => {
    const remoteData = new Map<string, unknown>();
    const remote: SellerProfileStorage = {
      load: async (id) => (remoteData.get(id) as never) ?? null,
      save: vi.fn(async (id, p) => { remoteData.set(id, p); return p; }),
      saveIfAbsent: vi.fn(async (id, p) => { if (!remoteData.has(id)) remoteData.set(id, p); }),
    };
    const local: SellerProfileStorage = { load: async () => ({ ...complete }), save: vi.fn(async (_i, p) => p) };
    const migrating = createMigratingSellerProfileStorage(remote, local);
    expect(await migrating.load("u1")).toEqual(complete);
    expect(remote.saveIfAbsent).toHaveBeenCalledTimes(1);
    expect(await migrating.load("u1")).toEqual(complete);
    expect(remote.saveIfAbsent).toHaveBeenCalledTimes(1);

    // banco com dado mais recente vence o navegador
    remoteData.set("u2", { ...complete, display_name: "Mais recente" });
    expect((await migrating.load("u2"))?.display_name).toBe("Mais recente");
    expect(remote.saveIfAbsent).toHaveBeenCalledTimes(1);
    await migrating.save("u1", complete);
    expect(local.save).not.toHaveBeenCalled();
  });
});
