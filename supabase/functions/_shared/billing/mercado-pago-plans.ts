import { BILLING_CATALOG, type BillingPlanId } from "./catalog.ts";

const MP_API = "https://api.mercadopago.com";

export interface MercadoPagoPlanSummary {
  id: string;
  reason: string;
  status: string;
  transactionAmount: number;
  currencyId: string;
  frequency: number;
  frequencyType: string;
  freeTrialDays: number;
  initPoint?: string;
}

export type MercadoPagoPlanMap = Record<BillingPlanId, string>;

async function mpFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || payload?.error || `mercado_pago_error_${response.status}`);
    (err as any).status = response.status;
    (err as any).payload = payload;
    throw err;
  }
  return payload;
}

export async function searchExistingPlans(token: string): Promise<MercadoPagoPlanSummary[]> {
  try {
    const res = await mpFetch(token, "/preapproval_plan/search?status=active&limit=50");
    const results = Array.isArray(res?.results) ? res.results : [];
    return results.map((p: any) => ({
      id: String(p.id),
      reason: String(p.reason || ""),
      status: String(p.status || ""),
      transactionAmount: Number(p.auto_recurring?.transaction_amount || 0),
      currencyId: String(p.auto_recurring?.currency_id || "BRL"),
      frequency: Number(p.auto_recurring?.frequency || 1),
      frequencyType: String(p.auto_recurring?.frequency_type || "months"),
      freeTrialDays: Number(p.auto_recurring?.free_trial?.frequency || 0),
      initPoint: p.init_point ? String(p.init_point) : undefined,
    }));
  } catch (err) {
    console.error("Erro ao buscar planos no Mercado Pago:", err);
    return [];
  }
}

export function matchPlan(
  existingList: MercadoPagoPlanSummary[],
  planId: BillingPlanId,
  amount: number,
  trialDays: number,
): MercadoPagoPlanSummary | null {
  const targetReason = `ZUNO PROSPECT - ${BILLING_CATALOG[planId].displayName}`.toLowerCase();
  return existingList.find((p) => {
    const reasonMatch = p.reason.toLowerCase().includes(BILLING_CATALOG[planId].displayName.toLowerCase())
      || p.reason.toLowerCase() === targetReason;
    const amountMatch = Math.abs(p.transactionAmount - amount) < 0.01;
    const currencyMatch = p.currencyId === "BRL";
    const recurrenceMatch = p.frequency === 1 && p.frequencyType === "months";
    const trialMatch = trialDays > 0 ? p.freeTrialDays === trialDays : p.freeTrialDays === 0;

    return p.status === "active" && amountMatch && currencyMatch && recurrenceMatch && trialMatch && reasonMatch;
  }) || null;
}

export async function createPreapprovalPlan(
  token: string,
  planId: BillingPlanId,
  amount: number,
  trialDays: number,
  backUrl: string,
): Promise<{ id: string; initPoint: string }> {
  const autoRecurring: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: amount,
    currency_id: "BRL",
  };

  if (trialDays > 0) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: "days",
    };
  }

  const payload = {
    reason: `ZUNO PROSPECT - ${BILLING_CATALOG[planId].displayName}`,
    auto_recurring: autoRecurring,
    payment_methods_allowed: {
      payment_types: [{ id: "credit_card" }],
    },
    back_url: backUrl,
  };

  const res = await mpFetch(token, "/preapproval_plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res?.id) {
    throw new Error(`Falha ao criar plano ${planId} no Mercado Pago: id ausente`);
  }

  return {
    id: String(res.id),
    initPoint: String(res.init_point || ""),
  };
}

export async function getOrSyncMercadoPagoPlans(
  supabaseAdmin: any,
  accessToken: string,
  backUrl: string,
  trialDays = 7,
): Promise<MercadoPagoPlanMap> {
  const { data: config } = await supabaseAdmin
    .from("billing_provider_config")
    .select("mercado_pago_plan_ids")
    .eq("singleton", true)
    .single();

  const currentIds: MercadoPagoPlanMap = (config?.mercado_pago_plan_ids as MercadoPagoPlanMap) || {
    starter: "",
    pro: "",
    agency: "",
  };

  const plansToCheck: BillingPlanId[] = ["starter", "pro", "agency"];
  const needsSync = plansToCheck.some((p) => !currentIds[p]);

  if (!needsSync) {
    return currentIds;
  }

  // Busca planos existentes no Mercado Pago para não duplicar
  const existingPlans = await searchExistingPlans(accessToken);
  const updatedIds: Partial<MercadoPagoPlanMap> = { ...currentIds };

  for (const planId of plansToCheck) {
    const expectedAmount = BILLING_CATALOG[planId].monthlyAmount;

    // 1. Procura plano já existente no Mercado Pago
    const found = matchPlan(existingPlans, planId, expectedAmount, trialDays);
    if (found) {
      console.log(`[Mercado Pago] Plano reutilizado: ${planId} -> ID: ${found.id}`);
      updatedIds[planId] = found.id;
    } else if (!updatedIds[planId]) {
      // 2. Se não existir, cria o plano de forma atômica
      console.log(`[Mercado Pago] Criando novo plano canônico: ${planId} (R$ ${expectedAmount}, trial ${trialDays}d)...`);
      const created = await createPreapprovalPlan(accessToken, planId, expectedAmount, trialDays, backUrl);
      console.log(`[Mercado Pago] Plano criado com sucesso: ${planId} -> ID: ${created.id}`);
      updatedIds[planId] = created.id;
    }
  }

  // Persiste os IDs no banco para zero reprocessamento futuro
  const finalMap = updatedIds as MercadoPagoPlanMap;
  await supabaseAdmin
    .from("billing_provider_config")
    .update({
      mercado_pago_plan_ids: finalMap,
      mercado_pago_trial_duration_days: trialDays,
      mercado_pago_trial_policy_version: `${trialDays}d_2026_10`,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);

  return finalMap;
}
