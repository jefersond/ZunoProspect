import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoAdapter } from "../_shared/billing/mercado-pago-adapter.ts";
import { StripeAdapter } from "../_shared/billing/stripe-adapter.ts";
import type {
  BillingCheckoutInput,
  BillingProviderConfig,
  BillingProviderName,
} from "../_shared/billing/types.ts";
import type { BillingCycle, BillingPlanId } from "../_shared/billing/catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validPlan(value: unknown): value is BillingPlanId {
  return ["starter", "pro", "agency"].includes(String(value));
}

function validCycle(value: unknown): value is BillingCycle {
  return ["monthly", "annual"].includes(String(value));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";
  const mercadoPagoWebhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") || "";
  const authHeader = req.headers.get("authorization") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader) {
    return json({ error: "billing_checkout_not_configured" }, 500);
  }

  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData } = await authed.auth.getUser();
  const user = authData.user;
  if (!user?.id || !user.email) return json({ error: "authentication_required" }, 401);

  const body = await req.json().catch(() => ({}));
  if (!validPlan(body.planId) || !validCycle(body.billingCycle)) {
    return json({ error: "invalid_plan_or_billing_cycle" }, 400);
  }

  const input: BillingCheckoutInput = {
    planId: body.planId,
    billingCycle: body.billingCycle,
    source: typeof body.source === "string" ? body.source.slice(0, 120) : null,
    offerId: typeof body.offerId === "string" ? body.offerId.slice(0, 120) : null,
  };

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const [{ data: config, error: configError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    admin.from("billing_provider_config").select("*").eq("singleton", true).single(),
    admin.from("user_subscriptions")
      .select("billing_provider,stripe_customer_id,stripe_subscription_id,mercado_pago_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (configError || !config) return json({ error: "billing_provider_config_missing" }, 503);
  if (subscriptionError) return json({ error: "subscription_lookup_failed" }, 500);

  const typedConfig = config as BillingProviderConfig;
  let requestedProvider: BillingProviderName;

  if (subscription?.stripe_customer_id || subscription?.stripe_subscription_id || subscription?.billing_provider === "stripe") {
    requestedProvider = "stripe";
  } else if (subscription?.mercado_pago_subscription_id || subscription?.billing_provider === "mercado_pago") {
    requestedProvider = "mercado_pago";
  } else {
    requestedProvider = typedConfig.default_new_billing_provider;
  }

  if (requestedProvider === "mercado_pago" && !typedConfig.mercado_pago_cutover_ready) {
    return json({ error: "mercado_pago_cutover_not_ready" }, 503);
  }
  if (requestedProvider === "mercado_pago" && (!mercadoPagoAccessToken || !mercadoPagoWebhookSecret)) {
    return json({ error: "mercado_pago_credentials_missing" }, 503);
  }

  const { data: claimedProvider, error: claimError } = await admin.rpc("claim_billing_provider", {
    p_user_id: user.id,
    p_requested_provider: requestedProvider,
  });

  if (claimError || !claimedProvider) {
    return json({ error: "billing_provider_claim_failed" }, 409);
  }

  const provider = String(claimedProvider) as BillingProviderName;
  try {
    if (provider === "stripe") {
      const adapter = new StripeAdapter(
        supabaseUrl,
        anonKey,
        authHeader,
        typedConfig.stripe_trial_duration_days,
        typedConfig.stripe_trial_policy_version,
      );
      const result = await adapter.createCheckout(input);
      return json(result);
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";
    if (!accessToken) return json({ error: "mercado_pago_credentials_missing" }, 503);

    const appUrl = (Deno.env.get("APP_URL") || "https://www.zunopropect.com.br").replace(/\/$/, "");
    const adapter = new MercadoPagoAdapter(
      admin,
      accessToken,
      user.id,
      typedConfig.mercado_pago_trial_duration_days,
      typedConfig.mercado_pago_trial_policy_version,
      `${appUrl}/prospeccao?subscription=success&provider=mercado_pago`,
    );
    const result = await adapter.createCheckout(input);
    return json(result);
  } catch (error) {
    const safeCode = (error as Error & { code?: string }).code || (error as Error)?.message || "billing_checkout_failed";
    return json({ error: String(safeCode).slice(0, 160) }, 502);
  }
});
