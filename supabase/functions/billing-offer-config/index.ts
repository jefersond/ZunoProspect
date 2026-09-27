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
    .select("default_new_billing_provider,stripe_trial_duration_days,stripe_trial_policy_version,mercado_pago_trial_duration_days,mercado_pago_trial_policy_version,mercado_pago_cutover_ready,starter_intro_offer_enabled,starter_intro_offer_key,starter_intro_offer_plan_id,starter_intro_offer_billing_cycle,starter_intro_offer_conversion_path,starter_intro_offer_intro_amount_cents,starter_intro_offer_regular_amount_cents,starter_intro_offer_duration")
    .eq("singleton", true)
    .single();

  if (error || !config) {
    return new Response(JSON.stringify({ error: "billing_offer_config_unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  let effectiveProvider: "stripe" | "mercado_pago" | null = null;
  let introOfferEligible = Boolean(config.starter_intro_offer_enabled);
  let introOfferEligibilityReason = introOfferEligible ? "eligible_preview" : "offer_disabled";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userId) {
      const [{ data: relation }, { data: redemption }] = await Promise.all([
        admin
          .from("user_subscriptions")
          .select("billing_provider,stripe_customer_id,stripe_subscription_id,mercado_pago_subscription_id,subscription_status,status,last_payment_succeeded_at")
          .eq("user_id", userId)
          .maybeSingle(),
        admin
          .from("billing_intro_offer_redemptions")
          .select("status,redeemed_at")
          .eq("user_id", userId)
          .eq("offer_key", config.starter_intro_offer_key)
          .maybeSingle(),
      ]);

      if (relation?.stripe_customer_id || relation?.stripe_subscription_id || relation?.billing_provider === "stripe") {
        effectiveProvider = "stripe";
      } else if (relation?.mercado_pago_subscription_id || relation?.billing_provider === "mercado_pago") {
        effectiveProvider = "mercado_pago";
      }

      const relationStatus = String(relation?.subscription_status || relation?.status || "").toLowerCase();
      const hasActiveSubscription = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(relationStatus);
      const hasPaidHistory = Boolean(relation?.last_payment_succeeded_at);
      const alreadyRedeemed = Boolean(redemption?.redeemed_at || redemption?.status === "redeemed");

      if (!config.starter_intro_offer_enabled) {
        introOfferEligible = false;
        introOfferEligibilityReason = "offer_disabled";
      } else if (hasActiveSubscription) {
        introOfferEligible = false;
        introOfferEligibilityReason = relationStatus === "trialing" ? "active_trial_not_supported" : "active_subscription";
      } else if (alreadyRedeemed) {
        introOfferEligible = false;
        introOfferEligibilityReason = "already_redeemed";
      } else if (hasPaidHistory) {
        introOfferEligible = false;
        introOfferEligibilityReason = "existing_paid_customer";
      } else {
        introOfferEligible = true;
        introOfferEligibilityReason = "eligible";
      }
    }
  }

  const defaultProvider = config.default_new_billing_provider === "mercado_pago" && config.mercado_pago_cutover_ready
    ? "mercado_pago"
    : "stripe";
  const provider = effectiveProvider || defaultProvider;
  const trialDurationDays = provider === "mercado_pago"
    ? config.mercado_pago_trial_duration_days
    : config.stripe_trial_duration_days;
  const trialPolicyVersion = provider === "mercado_pago"
    ? config.mercado_pago_trial_policy_version
    : config.stripe_trial_policy_version;

  return new Response(JSON.stringify({
    defaultNewBillingProvider: defaultProvider,
    effectiveBillingProvider: provider,
    trialDurationDays,
    trialPolicyVersion,
    requiresCard: true,
    introOffer: {
      enabled: Boolean(config.starter_intro_offer_enabled),
      key: String(config.starter_intro_offer_key || ""),
      planId: String(config.starter_intro_offer_plan_id || "starter"),
      billingCycle: String(config.starter_intro_offer_billing_cycle || "monthly"),
      conversionPath: String(config.starter_intro_offer_conversion_path || "direct_purchase"),
      duration: String(config.starter_intro_offer_duration || "first_billing_period"),
      introPrice: Number(config.starter_intro_offer_intro_amount_cents || 0) / 100,
      regularPrice: Number(config.starter_intro_offer_regular_amount_cents || 0) / 100,
      eligible: introOfferEligible && provider === "stripe",
      eligibilityReason: provider === "stripe" ? introOfferEligibilityReason : "stripe_only",
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
