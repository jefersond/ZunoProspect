import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, isSellerProfileComplete, sanitizeSellerProfile, type SellerProfile } from "./lead-analysis.ts";

/**
 * Estado comercial REAL do usuário, para o painel administrativo. O nome do plano sozinho nunca prova que o
 * usuário paga, e a ausência de status nunca vira "active": sem confirmação, o estado é "indefinido".
 */
export type CommercialState = "admin" | "paid_active" | "trial" | "free" | "canceled" | "past_due" | "indefinido";

export const COMMERCIAL_STATE_LABELS: Record<CommercialState, string> = {
  admin: "Administrador",
  paid_active: "Pago ativo",
  trial: "Em teste",
  free: "Gratuito",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  indefinido: "Indefinido (sem confirmação)",
};

export const PAID_PLAN_NAMES = ["starter", "iniciante", "pro", "agency", "agencia"];

/** Status bruto da assinatura, normalizado; null quando não há informação (nunca assume "active"). */
export function normalizeSubscriptionStatus(subscription: Record<string, unknown> | null | undefined): string | null {
  const raw = String(subscription?.subscription_status ?? subscription?.status ?? "").trim().toLowerCase();
  if (!raw) return null;
  return raw === "cancelled" ? "canceled" : raw;
}

export function classifyCommercialState(input: { planName: string; subscription?: Record<string, unknown> | null; isAdmin?: boolean }): CommercialState {
  if (input.isAdmin) return "admin";
  const status = normalizeSubscriptionStatus(input.subscription);
  const paidPlan = PAID_PLAN_NAMES.includes(input.planName);
  if (status === "trialing") return "trial";
  if (status === "canceled" || status === "expired" || status === "incomplete_expired") return "canceled";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (!paidPlan) return "free"; // plano gratuito (mesmo com linha de assinatura "active") não é pagante
  if (status === "active" || status === "authorized") return "paid_active";
  return "indefinido"; // plano pago no nome, sem status confirmando o pagamento
}

export type CommercialProfileSummary = {
  filled: boolean;
  complete: boolean;
  display_name: string;
  company_name: string;
  service_category: string;
  service_category_label: string;
  service_offered: string;
  offer_description: string;
  target_audience: string;
};

export function summarizeCommercialProfile(row: unknown): CommercialProfileSummary {
  const profile: SellerProfile = sanitizeSellerProfile(row);
  const filled = Boolean(row) && Object.values(profile).some((v) => String(v).trim());
  const category = profile.service_category as (typeof SERVICE_CATEGORIES)[number] | "";
  return {
    filled,
    complete: isSellerProfileComplete(profile),
    display_name: profile.display_name,
    company_name: profile.company_name,
    service_category: category,
    service_category_label: category ? SERVICE_CATEGORY_LABELS[category] : "",
    service_offered: profile.service_offered,
    offer_description: profile.offer_description,
    target_audience: profile.target_audience,
  };
}

export function summarizeByState(users: Array<{ commercial_state: CommercialState }>): Record<CommercialState, number> {
  const out: Record<CommercialState, number> = { admin: 0, paid_active: 0, trial: 0, free: 0, canceled: 0, past_due: 0, indefinido: 0 };
  for (const u of users) out[u.commercial_state] += 1;
  return out;
}

/** Categorias comerciais por estado (admins fora): separa pagos ativos de testes, gratuitos e cancelados. */
export function summarizeByCategory(
  users: Array<{ commercial_state: CommercialState; commercial_profile: CommercialProfileSummary }>,
): Record<string, Record<CommercialState, number>> {
  const out: Record<string, Record<CommercialState, number>> = {};
  for (const u of users) {
    if (u.commercial_state === "admin") continue;
    const key = u.commercial_profile.service_category || "nao_informado";
    out[key] ??= { admin: 0, paid_active: 0, trial: 0, free: 0, canceled: 0, past_due: 0, indefinido: 0 };
    out[key][u.commercial_state] += 1;
  }
  return out;
}
