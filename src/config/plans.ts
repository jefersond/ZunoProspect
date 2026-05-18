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
    displayName: "Iniciante",
    subtitle: "Ideal para validar nichos e começar a prospectar com consistência.",
    monthlyPrice: 47,
    annualPrice: 470,
    leadsLimit: 300,
    aiLimit: 30,
    highlighted: false,
    cta: "Assinar Iniciante",
    features: [
      "Análise de leads com diagnóstico",
      "Plano de prospecção de 7 dias",
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
    subtitle: "Mais escolhido para quem prospecta toda semana.",
    monthlyPrice: 97,
    annualPrice: 970,
    leadsLimit: 800,
    aiLimit: 100,
    highlighted: true,
    badge: "Mais popular",
    cta: "Assinar Pro",
    features: [
      "Tudo do Iniciante",
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
    displayName: "Agência",
    subtitle: "Para times e agências que prospectam em volume.",
    monthlyPrice: 247,
    annualPrice: 2470,
    leadsLimit: 2000,
    aiLimit: 300,
    highlighted: false,
    cta: "Assinar Agência",
    features: [
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

export function getPlanPrice(planId: PlanId, billingCycle: BillingCycle) {
  const plan = PLANS[planId];
  return billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

export function getPlanPeriodLabel(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? "/ano" : "/mês";
}
