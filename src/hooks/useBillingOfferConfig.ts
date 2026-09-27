import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  effectiveBillingProvider: BillingProvider;
  trialDurationDays: number | null;
  loading: boolean;
  error: string | null;
  trialPolicyVersion: string;
  requiresCard: boolean;
};

const INITIAL_CONFIG: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDurationDays: null,
  trialPolicyVersion: "",
  requiresCard: true,
  loading: true,
  error: null,
};

async function loadBillingOfferConfig(): Promise<BillingOfferConfig> {
  try {
    const { data, error } = await supabase.functions.invoke("billing-offer-config", { body: {} });
    if (error || !data) {
      return { ...INITIAL_CONFIG, loading: false, error: error?.message || "billing_offer_config_unavailable" };
    }

    const defaultProvider: BillingProvider = data.defaultNewBillingProvider === "mercado_pago"
      ? "mercado_pago"
      : "stripe";
    const effectiveProvider: BillingProvider = data.effectiveBillingProvider === "mercado_pago"
      ? "mercado_pago"
      : data.effectiveBillingProvider === "stripe"
        ? "stripe"
        : defaultProvider;
    const days = Number(data.trialDurationDays);

    return {
      defaultNewBillingProvider: defaultProvider,
      effectiveBillingProvider: effectiveProvider,
      trialDurationDays: Number.isFinite(days) && days > 0 ? days : null,
      trialPolicyVersion: String(data.trialPolicyVersion || ""),
      requiresCard: data.requiresCard !== false,
      loading: false,
      error: Number.isFinite(days) && days > 0 ? null : "invalid_trial_duration",
    };
  } catch (error) {
    return {
      ...INITIAL_CONFIG,
      loading: false,
      error: error instanceof Error ? error.message : "billing_offer_config_failed",
    };
  }
}

export function useBillingOfferConfig() {
  const [config, setConfig] = useState<BillingOfferConfig>(INITIAL_CONFIG);

  useEffect(() => {
    let active = true;
    void loadBillingOfferConfig().then((next) => {
      if (active) setConfig(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return config;
}
