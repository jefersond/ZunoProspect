import { useSyncExternalStore } from "react";
import {
  MIN_OFFER_DESCRIPTION_CHARS,
  isSellerProfileComplete,
  missingSellerProfileFields,
  sanitizeSellerProfile,
  type SellerProfile,
  type SellerProfileField,
} from "../../supabase/functions/_shared/lead-analysis";

// As regras de validação são as mesmas da Edge Function (fonte única em _shared/lead-analysis.ts).
export { MIN_OFFER_DESCRIPTION_CHARS, isSellerProfileComplete, missingSellerProfileFields, sanitizeSellerProfile };
export type { SellerProfile, SellerProfileField };

export const EMPTY_SELLER_PROFILE: SellerProfile = {
  display_name: "",
  company_name: "",
  service_offered: "",
  offer_description: "",
  target_audience: "",
};

export const SELLER_PROFILE_FIELD_LABELS: Record<SellerProfileField, string> = {
  display_name: "Nome de apresentação",
  company_name: "Empresa",
  service_offered: "Serviço oferecido",
  offer_description: "Descrição concreta da oferta",
  target_audience: "Público-alvo",
};

// ───────────────────────── Persistência ─────────────────────────

export interface SellerProfileStorage {
  load(userId: string): Promise<SellerProfile | null>;
  save(userId: string, profile: SellerProfile): Promise<void>;
}

const storageKey = (userId: string) => `zuno_seller_profile_v1:${userId}`;

/** Armazenamento atual: navegador, isolado por usuário. Não acompanha o assinante entre aparelhos. */
export const localSellerProfileStorage: SellerProfileStorage = {
  async load(userId) {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      return raw ? sanitizeSellerProfile(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  async save(userId, profile) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(profile));
    } catch {
      throw new Error("Não foi possível salvar o perfil neste navegador.");
    }
  },
};

type RemoteClient = {
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Armazenamento no Supabase (tabela `seller_profiles`, uma linha por usuário, RLS por auth.uid()).
 * A migration está proposta em docs/proposals/seller-profiles.sql e NÃO foi aplicada.
 * Só é usado quando SELLER_PROFILE_REMOTE_ENABLED for ligado após a aprovação.
 */
export function createRemoteSellerProfileStorage(client: RemoteClient): SellerProfileStorage {
  return {
    async load(userId) {
      const { data, error } = await client.from("seller_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error || !data) return null;
      return sanitizeSellerProfile(data);
    },
    async save(userId, profile) {
      const { error } = await client.from("seller_profiles").upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Quando o remoto for ligado, perfis já salvos no navegador sobem uma única vez para o Supabase
 * (o assinante não precisa preencher de novo). O navegador deixa de ser a fonte depois disso.
 */
export function createMigratingSellerProfileStorage(remote: SellerProfileStorage, local: SellerProfileStorage): SellerProfileStorage {
  return {
    async load(userId) {
      const fromRemote = await remote.load(userId);
      if (fromRemote) return fromRemote;
      const fromLocal = await local.load(userId);
      if (fromLocal) {
        try {
          await remote.save(userId, fromLocal);
        } catch {
          // Mantém o perfil local utilizável mesmo que a cópia remota falhe; tenta de novo na próxima carga.
        }
      }
      return fromLocal;
    },
    save: (userId, profile) => remote.save(userId, profile),
  };
}

export const SELLER_PROFILE_REMOTE_ENABLED = false;

// ───────────────────────── Estado compartilhado ─────────────────────────

interface SellerProfileState {
  userId: string | null;
  profile: SellerProfile;
  loaded: boolean;
  dialogOpen: boolean;
}

let state: SellerProfileState = { userId: null, profile: EMPTY_SELLER_PROFILE, loaded: false, dialogOpen: false };
let storage: SellerProfileStorage = localSellerProfileStorage;
const listeners = new Set<() => void>();

const setState = (next: Partial<SellerProfileState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const subscribeSellerProfile = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getSellerProfileState = () => state;
export const useSellerProfileState = () => useSyncExternalStore(subscribeSellerProfile, getSellerProfileState, getSellerProfileState);

export function configureSellerProfileStorage(next: SellerProfileStorage) {
  storage = next;
}

export function resetSellerProfileStateForTests() {
  loadSequence++;
  state = { userId: null, profile: EMPTY_SELLER_PROFILE, loaded: false, dialogOpen: false };
  storage = localSellerProfileStorage;
}

let loadSequence = 0;

/**
 * Troca o usuário ativo. O perfil do usuário anterior é descartado ANTES de qualquer leitura assíncrona,
 * então nunca fica acessível a outra conta durante a carga; e uma leitura atrasada de um usuário antigo
 * não sobrescreve o estado do usuário atual.
 */
export async function loadSellerProfileForUser(userId: string | null) {
  const sequence = ++loadSequence;
  setState({ userId, profile: EMPTY_SELLER_PROFILE, loaded: !userId, dialogOpen: userId ? state.dialogOpen : false });
  if (!userId) return;

  let stored: SellerProfile | null = null;
  try {
    stored = await storage.load(userId);
  } catch {
    stored = null; // armazenamento indisponível: segue sem perfil, sem erro para o usuário
  }
  if (sequence !== loadSequence) return;
  setState({ userId, profile: stored ?? EMPTY_SELLER_PROFILE, loaded: true });
}

export async function saveSellerProfile(input: unknown): Promise<SellerProfile> {
  const userId = state.userId;
  if (!userId) throw new Error("Entre na sua conta para salvar o perfil.");
  const profile = sanitizeSellerProfile(input);
  await storage.save(userId, profile);
  if (state.userId === userId) setState({ profile });
  return profile;
}

export const openSellerProfileDialog = () => setState({ dialogOpen: true });
export const closeSellerProfileDialog = () => setState({ dialogOpen: false });

/** Perfil a enviar para a análise, ou null se faltar algo que impede mensagens comerciais honestas. */
export function getSellerProfileForRequest(): SellerProfile | null {
  return isSellerProfileComplete(state.profile) ? state.profile : null;
}

/**
 * Use no início de qualquer ação que gera análise. Se o perfil estiver incompleto, abre o formulário
 * e retorna false: nenhuma chamada de IA é feita e nenhum crédito é consumido.
 */
export function ensureSellerProfileOrPrompt(): boolean {
  if (getSellerProfileForRequest()) return true;
  openSellerProfileDialog();
  return false;
}
