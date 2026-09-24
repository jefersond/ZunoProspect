import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: config, error } = await admin
    .from("billing_provider_config")
    .select("default_new_billing_provider,stripe_trial_duration_days,stripe_trial_policy_version,mercado_pago_trial_duration_days,mercado_pago_trial_policy_version,mercado_pago_cutover_ready")
    .eq("singleton", true)
    .single();

  if (error || !config) {
    return new Response(JSON.stringify({ error: "billing_offer_config_unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const provider = config.default_new_billing_provider === "mercado_pago" && config.mercado_pago_cutover_ready
    ? "mercado_pago"
    : "stripe";
  const trialDurationDays = provider === "mercado_pago"
    ? config.mercado_pago_trial_duration_days
    : config.stripe_trial_duration_days;
  const trialPolicyVersion = provider === "mercado_pago"
    ? config.mercado_pago_trial_policy_version
    : config.stripe_trial_policy_version;

  return new Response(JSON.stringify({
    defaultNewBillingProvider: provider,
    trialDurationDays,
    trialPolicyVersion,
    requiresCard: true,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
