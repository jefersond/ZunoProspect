import { sanitizeSellerProfile, type SellerProfile } from "./lead-analysis.ts";

type ProfileReader = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }> };
    };
  };
};

/**
 * Perfil comercial do PRÓPRIO usuário autenticado, lido no servidor (fonte oficial: tabela `seller_profiles`).
 * O corpo da requisição nunca fornece o perfil. Tabela/linha ausente ou erro de leitura resultam em perfil vazio,
 * que as pré-condições barram com REFINE_PROFILE_REQUIRED (antes de qualquer reserva, IA ou crédito).
 */
export async function loadSellerProfileForUser(admin: ProfileReader, userId: string): Promise<SellerProfile> {
  try {
    const { data, error } = await admin.from("seller_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error || !data) return sanitizeSellerProfile(null);
    return sanitizeSellerProfile(data);
  } catch {
    return sanitizeSellerProfile(null);
  }
}
