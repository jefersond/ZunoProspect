import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  effectiveBillingProvider: BillingProvider;
  /** Canonical trial shown to a new customer on public offer surfaces. */
  trialDays: number | null;
  /** Canonical trial for the provider effectively bound to the current user. */
  effectiveTrialDays: number | null;
  /** Backward-compatible effective-provider duration. */
  trialDurationDays: number;
  trialPolicyVersion: string;
  requiresCard: boolean;
  loading: boolean;
  error: string | null;
};

const FALLBACK: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDays: null,
  effectiveTrialDays: null,
  trialDurationDays: 7,
  trialPolicyVersion: "stripe_legacy_7d",
  requiresCard: true,
  loading: true,
  error: null,
};

async function loadBillingOfferConfig() {
  try {
    const { data, error } = await supabase.functions.invoke("billing-offer-config", { body: {} });
    if (error || !data) {
      return { ...FALLBACK, loading: false, error: "billing_offer_config_unavailable" };
    }

    const defaultProvider: BillingProvider = data.defaultNewBillingProvider === "mercado_pago"
      ? "mercado_pago"
      : "stripe";
    const effectiveProvider: BillingProvider = data.effectiveBillingProvider === "mercado_pago"
      ? "mercado_pago"
      : data.effectiveBillingProvider === "stripe"
        ? "stripe"
        : defaultProvider;
    const defaultDays = Number(data.defaultNewTrialDurationDays ?? data.trialDurationDays);
    const effectiveDays = Number(data.effectiveTrialDurationDays ?? data.trialDurationDays);
    const legacyDays = Number(data.trialDurationDays);

    return {
      defaultNewBillingProvider: defaultProvider,
      effectiveBillingProvider: effectiveProvider,
      trialDays: Number.isFinite(defaultDays) && defaultDays > 0 ? defaultDays : null,
      effectiveTrialDays: Number.isFinite(effectiveDays) && effectiveDays > 0 ? effectiveDays : null,
      trialDurationDays: Number.isFinite(legacyDays) && legacyDays > 0 ? legacyDays : FALLBACK.trialDurationDays,
      trialPolicyVersion: String(data.effectiveTrialPolicyVersion || data.trialPolicyVersion || FALLBACK.trialPolicyVersion),
      requiresCard: data.requiresCard !== false,
      loading: false,
      error: null,
    };
  } catch {
    return { ...FALLBACK, loading: false, error: "billing_offer_config_unavailable" };
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
