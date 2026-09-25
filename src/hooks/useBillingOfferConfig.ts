import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  effectiveBillingProvider: BillingProvider;
  trialDurationDays: number;
  trialPolicyVersion: string;
  requiresCard: boolean;
};

const FALLBACK: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDurationDays: 7,
  trialPolicyVersion: "stripe_legacy_7d",
  requiresCard: true,
};

async function loadBillingOfferConfig() {
  try {
    const { data, error } = await supabase.functions.invoke("billing-offer-config", { body: {} });
    if (error || !data) return FALLBACK;

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
      trialDurationDays: Number.isFinite(days) && days > 0 ? days : FALLBACK.trialDurationDays,
      trialPolicyVersion: String(data.trialPolicyVersion || FALLBACK.trialPolicyVersion),
      requiresCard: data.requiresCard !== false,
    };
  } catch {
    return FALLBACK;
  }
}

export function useBillingOfferConfig() {
  const [config, setConfig] = useState<BillingOfferConfig>(FALLBACK);

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
