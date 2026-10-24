export type BillingCycle = "monthly" | "annual";
export type PlanId = "starter" | "pro" | "agency";

export type PlanConfig = {
  id: PlanId;
  planKey: PlanId;
  legacyPlanKey: "starter" | "pro" | "agencia";
  name: string;
  displayName: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  leadsLimit: number;
  aiLimit: number;
  highlighted: boolean;
  badge?: string;
  cta: string;
  features: string[];
};

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    planKey: "starter",
    legacyPlanKey: "starter",
    name: "Starter",
    displayName: "Starter",
    subtitle: "Para começar a prospectar sozinho.",
    monthlyPrice: 47,
    annualPrice: 470,
    leadsLimit: 300,
    aiLimit: 30,
    highlighted: false,
    cta: "Começar teste grátis",
    features: [
      "300 leads por mês",
      "30 análises com IA por mês",
      "Teste grátis no plano escolhido",
      "Análise de leads com diagnóstico",
      "Plano de prospecção de {trialDays} dias",
      "CRM para salvar status e anotações",
      "Templates de mensagem",
    ],
  },
  pro: {
    id: "pro",
    planKey: "pro",
    legacyPlanKey: "pro",
    name: "Pro",
    displayName: "Pro",
    subtitle: "Para quem prospecta toda semana.",
    monthlyPrice: 97,
    annualPrice: 970,
    leadsLimit: 800,
    aiLimit: 100,
    highlighted: true,
    badge: "Mais popular",
    cta: "Começar teste grátis",
    features: [
      "800 leads por mês",
      "100 análises com IA por mês",
      "Teste grátis no plano escolhido",
      "Tudo do Starter",
      "Análise completa e score de oportunidade",
      "Abordagens para WhatsApp, Instagram e e-mail",
      "Exportação para Excel",
      "Suporte prioritário",
    ],
  },
  agency: {
    id: "agency",
    planKey: "agency",
    legacyPlanKey: "agencia",
    name: "Agency",
    displayName: "Agency",
    subtitle: "Para equipes que precisam de volume.",
    monthlyPrice: 247,
    annualPrice: 2470,
    leadsLimit: 2000,
    aiLimit: 300,
    highlighted: false,
    cta: "Começar teste grátis",
    features: [
      "2.000 leads por mês",
      "300 análises com IA por mês",
      "Teste grátis no plano escolhido",
      "Tudo do plano Pro",
      "Pipeline Kanban visual",
      "Relatórios e dashboards completos",
      "Acesso à API de integração",
      "Suporte prioritário com canal direto",
    ],
  },
};

export const PLAN_LIST = [PLANS.starter, PLANS.pro, PLANS.agency] as const;

export function normalizePlanId(value: unknown): PlanId | null {
  const key = String(value || "").trim().toLowerCase();

  if (key === "iniciante") return "starter";
  if (key === "agencia" || key === "agência") return "agency";
  if (key === "starter" || key === "pro" || key === "agency") return key;

  return null;
}

export type PlanResolutionResult =
  | {
      status: "valid";
      planId: PlanId;
      planoKey: "starter" | "pro" | "agencia";
      plan: PlanConfig;
    }
  | {
      status: "missing";
    }
  | {
      status: "invalid";
      reason: "unknown_plan" | "conflicting_params";
    };

/**
 * Resolve e valida os parâmetros 'plano' e 'plan' para o checkout,
 * garantindo fidelidade estrita à escolha do usuário:
 * - Valida contra os planos oficiais (starter, pro, agency).
 * - Se ambos forem passados e divergirem ou algum for desconhecido, marca como inválido.
 * - Nunca faz fallback silencioso para 'pro'.
 */
export function resolveCheckoutPlan(
  params: URLSearchParams | { plano?: string | null; plan?: string | null }
): PlanResolutionResult {
  const getParam = (key: "plano" | "plan"): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    return params[key] ?? null;
  };

  const hasPlano =
    params instanceof URLSearchParams
      ? params.has("plano")
      : "plano" in params && params.plano !== undefined;
  const hasPlan =
    params instanceof URLSearchParams
      ? params.has("plan")
      : "plan" in params && params.plan !== undefined;

  const rawPlano = getParam("plano")?.trim() || null;
  const rawPlan = getParam("plan")?.trim() || null;

  // Ausência total de parâmetros ou valores vazios
  if (!hasPlano && !hasPlan) {
    return { status: "missing" };
  }
  if (!rawPlano && !rawPlan) {
    return { status: "missing" };
  }

  // Ambos os parâmetros foram fornecidos
  if (rawPlano && rawPlan) {
    const normPlano = normalizePlanId(rawPlano);
    const normPlan = normalizePlanId(rawPlan);

    // Se qualquer um dos dois não corresponder a um plano oficial
    if (!normPlano || !normPlan) {
      return { status: "invalid", reason: "unknown_plan" };
    }

    // Se ambos forem válidos mas divergirem (valores conflitantes)
    if (normPlano !== normPlan) {
      return { status: "invalid", reason: "conflicting_params" };
    }

    const plan = PLANS[normPlano];
    return {
      status: "valid",
      planId: normPlano,
      planoKey: plan.legacyPlanKey,
      plan,
    };
  }

  // Apenas um parâmetro foi fornecido
  const single = rawPlano || rawPlan;
  const norm = normalizePlanId(single);

  if (!norm) {
    return { status: "invalid", reason: "unknown_plan" };
  }

  const plan = PLANS[norm];
  return {
    status: "valid",
    planId: norm,
    planoKey: plan.legacyPlanKey,
    plan,
  };
}

export function getPlanPrice(planId: PlanId, billingCycle: BillingCycle) {
  const plan = PLANS[planId];
  return billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

export function getPlanPeriodLabel(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? "/ano" : "/mês";
}

export function resolveTrialDaysCopy(value: string, trialDays: number | null) {
  if (trialDays) return value.replaceAll("{trialDays}", String(trialDays));
  return value
    .replaceAll(" de {trialDays} dias", " durante o teste")
    .replaceAll("{trialDays} dias", "período de teste");
}
