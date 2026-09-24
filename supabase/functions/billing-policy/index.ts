import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  MERCADO_PAGO_TRIAL_DURATION_DAYS,
  MERCADO_PAGO_TRIAL_POLICY_VERSION,
  STRIPE_LEGACY_TRIAL_DURATION_DAYS,
  STRIPE_LEGACY_TRIAL_POLICY_VERSION,
} from "../_shared/billing-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: "billing_policy_unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: config } = await admin
    .from("billing_provider_config")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();

  const defaultProvider = config?.default_new_billing_provider === "mercado_pago"
    && config?.mercado_pago_cutover_ready === true
      ? "mercado_pago"
      : "stripe";

  const result = defaultProvider === "mercado_pago"
    ? {
        billingProvider: "mercado_pago",
        trialDurationDays: Number(config?.mercado_pago_trial_duration_days || MERCADO_PAGO_TRIAL_DURATION_DAYS),
        trialPolicyVersion: config?.mercado_pago_trial_policy_version || MERCADO_PAGO_TRIAL_POLICY_VERSION,
      }
    : {
        billingProvider: "stripe",
        trialDurationDays: Number(config?.stripe_trial_duration_days || STRIPE_LEGACY_TRIAL_DURATION_DAYS),
        trialPolicyVersion: config?.stripe_trial_policy_version || STRIPE_LEGACY_TRIAL_POLICY_VERSION,
      };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=60" },
  });
});