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
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "",
};

const memoryStorage = () => {
  const data = new Map<string, unknown>();
  const storage: SellerProfileStorage = {
    load: async (id) => (data.get(id) as never) ?? null,
    save: vi.fn(async (id, p) => { data.set(id, p); }),
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

  it("adapter remoto (desligado por padrão, aguarda migration): upsert por user_id e leitura sanitizada", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...complete, user_id: "u1", extra: "x" }, error: null }) }) }),
        upsert,
      }),
    };
    const remote = createRemoteSellerProfileStorage(client as never);
    await remote.save("u1", { ...complete });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", display_name: "Marina Costa" }), { onConflict: "user_id" });
    const loaded = await remote.load("u1");
    expect(loaded).toEqual(complete);
  });

  it("migração: perfil que só existe no navegador sobe uma vez para o remoto", async () => {
    const remoteData = new Map<string, unknown>();
    const remote: SellerProfileStorage = { load: async (id) => (remoteData.get(id) as never) ?? null, save: vi.fn(async (id, p) => { remoteData.set(id, p); }) };
    const local: SellerProfileStorage = { load: async () => ({ ...complete }), save: vi.fn(async () => undefined) };
    const migrating = createMigratingSellerProfileStorage(remote, local);
    expect(await migrating.load("u1")).toEqual(complete);
    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(await migrating.load("u1")).toEqual(complete); // agora vem do remoto
    expect(remote.save).toHaveBeenCalledTimes(1);
    await migrating.save("u1", complete);
    expect(local.save).not.toHaveBeenCalled();
  });
});
