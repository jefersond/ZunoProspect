import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type IntroOfferConfig = {
  enabled: boolean;
  key: string;
  planId: "starter";
  billingCycle: "monthly";
  conversionPath: "direct_purchase";
  duration: "first_billing_period";
  introPrice: number | null;
  regularPrice: number | null;
  eligible: boolean;
  eligibilityReason: string;
};

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  effectiveBillingProvider: BillingProvider;
  trialDurationDays: number | null;
  loading: boolean;
  error: string | null;
  trialPolicyVersion: string;
  requiresCard: boolean;
  introOffer: IntroOfferConfig;
};

const INITIAL_CONFIG: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDurationDays: null,
  trialPolicyVersion: "",
  requiresCard: true,
  introOffer: {
    enabled: false,
    key: "",
    planId: "starter",
    billingCycle: "monthly",
    conversionPath: "direct_purchase",
    duration: "first_billing_period",
    introPrice: null,
    regularPrice: null,
    eligible: false,
    eligibilityReason: "loading",
  },
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
    const introPrice = Number(data.introOffer?.introPrice);
    const regularPrice = Number(data.introOffer?.regularPrice);

    return {
      defaultNewBillingProvider: defaultProvider,
      effectiveBillingProvider: effectiveProvider,
      trialDurationDays: Number.isFinite(days) && days > 0 ? days : null,
      trialPolicyVersion: String(data.trialPolicyVersion || ""),
      requiresCard: data.requiresCard !== false,
      introOffer: {
        enabled: data.introOffer?.enabled === true,
        key: String(data.introOffer?.key || ""),
        planId: "starter",
        billingCycle: "monthly",
        conversionPath: "direct_purchase",
        duration: "first_billing_period",
        introPrice: Number.isFinite(introPrice) && introPrice > 0 ? introPrice : null,
        regularPrice: Number.isFinite(regularPrice) && regularPrice > 0 ? regularPrice : null,
        eligible: data.introOffer?.eligible === true,
        eligibilityReason: String(data.introOffer?.eligibilityReason || ""),
      },
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
