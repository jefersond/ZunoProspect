import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Default pricing config (used for calculations if DB fetch fails)
export const LEAD_PRICING_CONFIG: LeadPricingConfig = {
  basePrice: {
    starter: 47,
    pro: 97,
    agencia: 147,
  },
  incrementLeads: 50,
  incrementPrice: 23.50,
  minLeads: 100,
  maxLeads: 2000,
};

// Available lead quantities
export const LEAD_QUANTITIES = [
  300, 800, 2000
];

export function useLeadPricing() {
  const [tiers, setTiers] = useState<LeadPricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPricing() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('lead_pricing_tiers')
          .select('*')
          .eq('active', true)
          .order('leads_quantity', { ascending: true });

        if (fetchError) throw fetchError;
        setTiers(data || []);
      } catch (err: any) {
        console.error('Error fetching pricing:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPricing();
  }, []);

  // Calculate price for a specific plan and quantity
  const calculatePrice = useCallback((planName: string, leadsQuantity: number, isAnnual: boolean = false): number => {
    const normalizedPlanName = planName === "iniciante" ? "starter" : planName;
    const safeLeadsQuantity = Number(leadsQuantity);

    if (!Number.isFinite(safeLeadsQuantity) || safeLeadsQuantity <= 0) {
      return Number.NaN;
    }

    // Try to find in cached tiers first
    const tier = tiers.find(t => {
      const tierPlanName = t.plan_name === "iniciante" ? "starter" : t.plan_name;
      return tierPlanName === normalizedPlanName && t.leads_quantity === safeLeadsQuantity;
    });
    if (tier) {
      return isAnnual ? tier.price_annual : tier.price_monthly;
    }

    // Fallback to formula calculation used by lead_pricing_tiers.
    const basePrice = LEAD_PRICING_CONFIG.basePrice[normalizedPlanName] || LEAD_PRICING_CONFIG.basePrice.starter;
    const leadsAboveBase = Math.max(0, safeLeadsQuantity - LEAD_PRICING_CONFIG.minLeads);
    const increments = leadsAboveBase / LEAD_PRICING_CONFIG.incrementLeads;
    const monthlyPrice = basePrice + (increments * LEAD_PRICING_CONFIG.incrementPrice);
    
    return isAnnual ? Math.round(monthlyPrice * 10) : Math.round(monthlyPrice * 100) / 100;
  }, [tiers]);

  // Get monthly price displayed (for annual, show per month equivalent)
  const getDisplayPrice = useCallback((planName: string, leadsQuantity: number, isAnnual: boolean = false): number => {
    if (isAnnual) {
      const annualPrice = calculatePrice(planName, leadsQuantity, true);
      return Math.round(annualPrice / 12);
    }
    return calculatePrice(planName, leadsQuantity, false);
  }, [calculatePrice]);

  // Get tiers for a specific plan
  const getTiersForPlan = useCallback((planName: string): LeadPricingTier[] => {
    return tiers.filter(t => t.plan_name === planName);
  }, [tiers]);

  return {
    tiers,
    loading,
    error,
    calculatePrice,
    getDisplayPrice,
    getTiersForPlan,
    quantities: LEAD_QUANTITIES,
    config: LEAD_PRICING_CONFIG,
  };
}
