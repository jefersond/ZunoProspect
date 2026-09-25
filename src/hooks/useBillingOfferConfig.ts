import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BillingProvider } from "@/services/billingCheckout";

export type BillingOfferConfig = {
  defaultNewBillingProvider: BillingProvider;
  trialDurationDays: number;
  trialPolicyVersion: string;
  requiresCard: boolean;
};

const FALLBACK: BillingOfferConfig = {
  defaultNewBillingProvider: "stripe",
  trialDurationDays: 7,
  trialPolicyVersion: "stripe_legacy_7d",
  requiresCard: true,
};

let cached: BillingOfferConfig | null = null;
let pending: Promise<BillingOfferConfig> | null = null;

async function loadBillingOfferConfig() {
  if (cached) return cached;
  if (pending) return pending;

  pending = supabase.functions.invoke("billing-offer-config", { body: {} })
    .then(({ data, error }) => {
      if (error || !data) return FALLBACK;
      const provider: BillingProvider = data.defaultNewBillingProvider === "mercado_pago"
        ? "mercado_pago"
        : "stripe";
      const days = Number(data.trialDurationDays);
      cached = {
        defaultNewBillingProvider: provider,
        trialDurationDays: Number.isFinite(days) && days > 0 ? days : FALLBACK.trialDurationDays,
        trialPolicyVersion: String(data.trialPolicyVersion || FALLBACK.trialPolicyVersion),
        requiresCard: data.requiresCard !== false,
      };
      return cached;
    })
    .catch(() => FALLBACK)
    .finally(() => {
      pending = null;
    });

  return pending;
}

export function useBillingOfferConfig() {
  const [config, setConfig] = useState<BillingOfferConfig>(cached || FALLBACK);

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
