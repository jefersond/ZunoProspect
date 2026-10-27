import { useSyncExternalStore } from "react";
import {
  MIN_OFFER_DESCRIPTION_CHARS,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  isSellerProfileComplete,
  missingSellerProfileFields,
  sanitizeSellerProfile,
  type SellerProfile,
  type SellerProfileField,
} from "../../supabase/functions/_shared/lead-analysis";

// As regras de validação são as mesmas da Edge Function (fonte única em _shared/lead-analysis.ts).
export { MIN_OFFER_DESCRIPTION_CHARS, SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, isSellerProfileComplete, missingSellerProfileFields, sanitizeSellerProfile };
export type { SellerProfile, SellerProfileField };

export const EMPTY_SELLER_PROFILE: SellerProfile = {
  display_name: "",
  company_name: "",
  service_category: "",
  service_offered: "",
  offer_description: "",
  target_audience: "",
};

export const SELLER_PROFILE_FIELD_LABELS: Record<SellerProfileField, string> = {
  display_name: "Nome de apresentação",
  company_name: "Empresa ou marca",
  service_category: "Categoria do serviço",
  service_offered: "Serviço oferecido",
  offer_description: "Descrição concreta da oferta",
  target_audience: "Público-alvo",
};

/**
 * Fonte oficial do perfil: tabela `seller_profiles` no Supabase (RLS por auth.uid()). Fica DESLIGADA por padrão e só
 * é ligada (VITE_SELLER_PROFILE_REMOTE=true) depois que a migration proposta em docs/proposals/seller-profiles.sql
 * for aplicada; com ela desligada o perfil continua só no navegador e a análise exige o perfil salvo no servidor.
 */
export const SELLER_PROFILE_REMOTE_ENABLED = import.meta.env?.VITE_SELLER_PROFILE_REMOTE === "true";

// ───────────────────────── Persistência ─────────────────────────

export interface SellerProfileStorage {
  /** Devolve null só quando NÃO existe perfil salvo; erro de leitura lança (não se confunde "não achei" com "falhou"). */
  load(userId: string): Promise<SellerProfile | null>;
  /** Grava e devolve o perfil CONFIRMADO pelo armazenamento. Lança se a gravação falhar. */
  save(userId: string, profile: SellerProfile): Promise<SellerProfile>;
  /** Cria o perfil somente se ainda não existir; nunca sobrescreve uma linha existente. */
  saveIfAbsent?(userId: string, profile: SellerProfile): Promise<void>;
}

const storageKey = (userId: string) => `zuno_seller_profile_v1:${userId}`;

/** Armazenamento do navegador, isolado por usuário. Não acompanha o assinante entre aparelhos. */
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
    return profile;
  },
};

type QueryError = { message: string } | null;
export type RemoteSellerProfileClient = {
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: QueryError }> } };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => { select: (cols: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: QueryError }> } } & PromiseLike<{ error: QueryError }>;
  };
};

/** Armazenamento no Supabase: uma linha por usuário; a RLS garante que só o dono lê e altera. */
export function createRemoteSellerProfileStorage(client: RemoteSellerProfileClient): SellerProfileStorage {
  return {
    async load(userId) {
      const { data, error } = await client.from("seller_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`Não foi possível carregar seu perfil comercial: ${error.message}`);
      return data ? sanitizeSellerProfile(data) : null;
    },
    async save(userId, profile) {
      const { data, error } = await client
        .from("seller_profiles")
        .upsert({ user_id: userId, ...profile }, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error || !data) throw new Error(`Não foi possível salvar seu perfil comercial: ${error?.message ?? "sem confirmação do banco"}`);
      return sanitizeSellerProfile(data); // o que o banco devolveu, não o que enviamos
    },
    async saveIfAbsent(userId, profile) {
      const { error } = await client.from("seller_profiles").upsert({ user_id: userId, ...profile }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Perfis já salvos no navegador sobem UMA vez para o Supabase, sem nunca sobrescrever uma linha existente
 * (dados mais recentes do banco vencem). Depois disso o banco é a única fonte.
 */
export function createMigratingSellerProfileStorage(remote: SellerProfileStorage, local: SellerProfileStorage): SellerProfileStorage {
  return {
    async load(userId) {
      const fromRemote = await remote.load(userId); // erro de leitura propaga: nada é migrado nem sobrescrito às cegas
      if (fromRemote) return fromRemote;
      const fromLocal = await local.load(userId);
      if (!fromLocal) return null;
      try {
        await remote.saveIfAbsent?.(userId, fromLocal);
        return (await remote.load(userId)) ?? fromLocal;
      } catch {
        return fromLocal; // continua utilizável e editável; a próxima gravação informa qualquer falha
      }
    },
    save: (userId, profile) => remote.save(userId, profile),
  };
}

// ───────────────────────── Estado compartilhado ─────────────────────────

interface SellerProfileState {
  userId: string | null;
  profile: SellerProfile;
  loaded: boolean;
  dialogOpen: boolean;
  /** Mensagem quando o perfil salvo não pôde ser lido (o usuário é avisado e nada é sobrescrito automaticamente). */
  loadError: string | null;
}

let state: SellerProfileState = { userId: null, profile: EMPTY_SELLER_PROFILE, loaded: false, dialogOpen: false, loadError: null };
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
  state = { userId: null, profile: EMPTY_SELLER_PROFILE, loaded: false, dialogOpen: false, loadError: null };
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
  setState({ userId, profile: EMPTY_SELLER_PROFILE, loaded: !userId, dialogOpen: userId ? state.dialogOpen : false, loadError: null });
  if (!userId) return;

  let stored: SellerProfile | null = null;
  let loadError: string | null = null;
  try {
    stored = await storage.load(userId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Não foi possível carregar seu perfil comercial.";
  }
  if (sequence !== loadSequence) return;
  setState({ userId, profile: stored ?? EMPTY_SELLER_PROFILE, loaded: true, loadError });
}

export async function saveSellerProfile(input: unknown): Promise<SellerProfile> {
  const userId = state.userId;
  if (!userId) throw new Error("Entre na sua conta para salvar o perfil.");
  const profile = sanitizeSellerProfile(input);
  const confirmed = await storage.save(userId, profile); // lança se o banco não confirmar: o estado NÃO muda
  if (state.userId === userId) setState({ profile: confirmed, loadError: null });
  return confirmed;
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
