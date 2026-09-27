import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  effectiveBillingProvider: BillingProvider;
  trialDurationDays: number | null;
  trialDays: number | null;
  trialPolicyVersion: string | null;
  requiresCard: boolean;
  loading: boolean;
  error: string | null;
};

const INITIAL_CONFIG: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  effectiveBillingProvider: "stripe",
  trialDurationDays: null,
  trialDays: null,
  trialPolicyVersion: null,
  requiresCard: true,
  loading: true,
  error: null,
};

const BillingOfferContext = createContext<BillingOfferConfig | null>(null);

async function loadBillingOfferConfig(): Promise<Omit<BillingOfferConfig, "loading" | "error">> {
  const { data, error } = await supabase.functions.invoke("billing-offer-config", { body: {} });
  if (error || !data) {
    throw error || new Error("billing_offer_config_missing");
  }

  const defaultProvider: BillingProvider = data.defaultNewBillingProvider === "mercado_pago"
    ? "mercado_pago"
    : data.defaultNewBillingProvider === "stripe"
      ? "stripe"
      : (() => { throw new Error("billing_offer_default_provider_invalid"); })();

  const effectiveProvider: BillingProvider = data.effectiveBillingProvider === "mercado_pago"
    ? "mercado_pago"
    : data.effectiveBillingProvider === "stripe"
      ? "stripe"
      : defaultProvider;

  const days = Number(data.trialDurationDays);
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("billing_offer_trial_duration_invalid");
  }

  const trialPolicyVersion = String(data.trialPolicyVersion || "").trim();
  if (!trialPolicyVersion) {
    throw new Error("billing_offer_trial_policy_missing");
  }

  return {
    defaultNewBillingProvider: defaultProvider,
    effectiveBillingProvider: effectiveProvider,
    trialDurationDays: days,
    trialDays: days,
    trialPolicyVersion,
    requiresCard: data.requiresCard !== false,
  };
}

export function BillingOfferProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BillingOfferConfig>(INITIAL_CONFIG);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      setConfig((current) => ({ ...current, loading: true, error: null }));
      try {
        const next = await loadBillingOfferConfig();
        if (active) {
          setConfig({ ...next, loading: false, error: null });
        }
      } catch (err) {
        if (active) {
          setConfig((current) => ({
            ...current,
            trialDurationDays: null,
            trialDays: null,
            trialPolicyVersion: null,
            loading: false,
            error: err instanceof Error ? err.message : "billing_offer_config_failed",
          }));
        }
      }
    };

    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return createElement(BillingOfferContext.Provider, { value: config }, children);
}

export function useBillingOfferConfig() {
  const config = useContext(BillingOfferContext);
  if (!config) {
    throw new Error("useBillingOfferConfig must be used within BillingOfferProvider");
  }
  return config;
}
