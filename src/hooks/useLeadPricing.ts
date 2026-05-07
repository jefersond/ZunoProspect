import { useCallback } from "react";

export interface LeadPricingTier {
  id: string;
  plan_name: string;
  leads_quantity: number;
  price_monthly: number;
  price_annual: number;
}

export interface LeadPricingConfig {
  basePrice: Record<string, number>;
  incrementLeads: number;
  incrementPrice: number;
  minLeads: number;
  maxLeads: number;
}

export const LEAD_PRICING_CONFIG: LeadPricingConfig = {
  basePrice: {
    starter: 47,
    pro: 97,
    agencia: 247,
    agency: 247,
  },
  incrementLeads: 0,
  incrementPrice: 0,
  minLeads: 300,
  maxLeads: 2000,
};

export const LEAD_QUANTITIES = [300, 800, 2000];

const FIXED_PLAN_PRICES: Record<string, number> = {
  iniciante: 47,
  starter: 47,
  pro: 97,
  agencia: 247,
  agency: 247,
};

function normalizePlanName(planName: string) {
  const normalized = String(planName || "").trim().toLowerCase();
  if (normalized === "iniciante") return "starter";
  if (normalized === "agency") return "agencia";
  return normalized;
}

export function useLeadPricing() {
  const calculatePrice = useCallback((planName: string, _leadsQuantity?: number, _isAnnual?: boolean): number => {
    const normalizedPlanName = normalizePlanName(planName);
    return FIXED_PLAN_PRICES[normalizedPlanName] ?? Number.NaN;
  }, []);

  const getDisplayPrice = useCallback((planName: string, _leadsQuantity?: number, _isAnnual?: boolean): number => {
    return calculatePrice(planName);
  }, [calculatePrice]);

  const getTiersForPlan = useCallback((_planName: string): LeadPricingTier[] => {
    return [];
  }, []);

  return {
    tiers: [] as LeadPricingTier[],
    loading: false,
    error: null as string | null,
    calculatePrice,
    getDisplayPrice,
    getTiersForPlan,
    quantities: LEAD_QUANTITIES,
    config: LEAD_PRICING_CONFIG,
  };
}
