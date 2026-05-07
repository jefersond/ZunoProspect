import { useCallback } from "react";
import { PLANS, normalizePlanId, type BillingCycle } from "@/config/plans";

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

function getPrice(planName: string, isAnnual?: boolean) {
  const planId = normalizePlanId(planName);
  if (!planId) return Number.NaN;

  const billingCycle: BillingCycle = isAnnual ? "annual" : "monthly";
  return billingCycle === "annual" ? PLANS[planId].annualPrice : PLANS[planId].monthlyPrice;
}

export function useLeadPricing() {
  const calculatePrice = useCallback((planName: string, _leadsQuantity?: number, isAnnual?: boolean): number => {
    return getPrice(planName, isAnnual);
  }, []);

  const getDisplayPrice = useCallback((planName: string, _leadsQuantity?: number, isAnnual?: boolean): number => {
    return calculatePrice(planName, _leadsQuantity, isAnnual);
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
