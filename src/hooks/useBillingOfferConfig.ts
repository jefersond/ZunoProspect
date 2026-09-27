import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type IntroOfferPlanConfig = {
  introPrice: number | null;
  regularPrice: number | null;
};

export type IntroOfferConfig = {
  enabled: boolean;
  key: string;
  billingCycle: "monthly";
  conversionPath: "direct_purchase";
  duration: "first_billing_period";
  plans: Record<"starter" | "pro" | "agency", IntroOfferPlanConfig>;
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

const EMPTY_PLAN: IntroOfferPlanConfig = { introPrice: null, regularPrice: null };

const INITIAL_CONFIG: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDurationDays: null,
  trialPolicyVersion: "",
  requiresCard: true,
  introOffer: {
    enabled: false,
    key: "",
    billingCycle: "monthly",
    conversionPath: "direct_purchase",
    duration: "first_billing_period",
    plans: {
      starter: EMPTY_PLAN,
      pro: EMPTY_PLAN,
      agency: EMPTY_PLAN,
    },
    eligible: false,
    eligibilityReason: "loading",
  },
  loading: true,
  error: null,
};

function normalizePlanOffer(value: any): IntroOfferPlanConfig {
  const introPrice = Number(value?.introPrice);
  const regularPrice = Number(value?.regularPrice);
  return {
    introPrice: Number.isFinite(introPrice) && introPrice > 0 ? introPrice : null,
    regularPrice: Number.isFinite(regularPrice) && regularPrice > 0 ? regularPrice : null,
  };
}

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
      introOffer: {
        enabled: data.introOffer?.enabled === true,
        key: String(data.introOffer?.key || ""),
        billingCycle: "monthly",
        conversionPath: "direct_purchase",
        duration: "first_billing_period",
        plans: {
          starter: normalizePlanOffer(data.introOffer?.plans?.starter),
          pro: normalizePlanOffer(data.introOffer?.plans?.pro),
          agency: normalizePlanOffer(data.introOffer?.plans?.agency),
        },
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
