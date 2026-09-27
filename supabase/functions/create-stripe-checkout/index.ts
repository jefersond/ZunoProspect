import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { BILLING_CATALOG, billingAmount, type BillingCycle, type BillingPlanId } from "../_shared/billing/catalog.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizePlanId(value: unknown): BillingPlanId | null {
  const planId = String(value || "").trim().toLowerCase();

  if (planId === "iniciante") return "starter";
  if (planId === "agencia" || planId === "agência") return "agency";
  if (planId === "starter" || planId === "pro" || planId === "agency") return planId;

  return null;
}

function normalizeBillingCycle(value: unknown): BillingCycle | null {
  const billingCycle = String(value || "").trim().toLowerCase();
  if (billingCycle === "monthly" || billingCycle === "annual") return billingCycle;
  return null;
}

function getStripeMode(secretKey: string) {
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

async function logAppEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    eventType: string;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  try {
    await supabaseAdmin.rpc("log_app_event", {
      p_user_id: params.userId,
      p_event_type: params.eventType,
      p_event_data: params.eventData || {},
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
    });
  } catch (eventError) {
    console.warn("[create-stripe-checkout] Falha ao registrar app_event", eventError);
  }
}

async function logPaymentEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  try {
    await supabaseAdmin.from("payment_events").insert(values);
  } catch (eventError) {
    console.warn("[create-stripe-checkout] Falha ao registrar payment_event", eventError);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const functionName = "create-stripe-checkout";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || "";

  if (!stripeSecretKey) {
    return jsonResponse({ error: "STRIPE_SECRET_KEY ausente" }, 500);
  }

  if (!publicSiteUrl) {
    return jsonResponse({ error: "PUBLIC_SITE_URL ausente" }, 500);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planId = normalizePlanId(body.planId ?? body.planKey);
    const billingCycle = normalizeBillingCycle(body.billingCycle);

    console.log("Checkout request:", {
      functionName,
      hasAuthHeader: Boolean(authHeader),
      hasToken: Boolean(token),
      planId,
      billingCycle,
      userId: null,
      stripeMode: getStripeMode(stripeSecretKey),
    });

    if (!planId) {
      return jsonResponse({ error: "planId inválido" }, 400);
    }

    if (!billingCycle) {
      return jsonResponse({ error: "billingCycle inválido. Use monthly ou annual." }, 400);
    }

    if (!authHeader) {
      console.warn("Checkout auth:", {
        hasAuthHeader: false,
        hasToken: false,
        userId: null,
        userEmail: null,
      });

      return jsonResponse({
        error: "Usuário não autenticado",
        details: "Authorization header ausente",
      }, 401);
    }

    if (!token) {
      console.warn("Checkout auth:", {
        hasAuthHeader: true,
        hasToken: false,
        userId: null,
        userEmail: null,
      });

      return jsonResponse({
        error: "Usuário não autenticado",
        details: "Token ausente",
      }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    console.log("Checkout auth:", {
      hasAuthHeader: Boolean(authHeader),
      hasToken: Boolean(token),
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    });

    if (userError || !user) {
      console.warn("Checkout unauthenticated", {
        hasAuthHeader: Boolean(authHeader),
        hasToken: Boolean(token),
        planId,
        billingCycle,
        details: userError?.message || "Token inválido",
      });

      return jsonResponse({
        error: "Usuário não autenticado",
        details: userError?.message || "Token inválido",
      }, 401);
    }

    console.log("Checkout authenticated:", {
      functionName,
      hasAuthHeader: Boolean(authHeader),
      hasToken: Boolean(token),
      planId,
      billingCycle,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const plan = BILLING_CATALOG[planId];
    const unitAmount = billingAmount(planId, billingCycle) * 100;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const source = body.source || "upgrade";
    const offerId = body.offerId || null;
    const conversionPath = body.conversionPath === "direct_purchase" ? "direct_purchase" : "trial";

    const { data: billingConfig, error: billingConfigError } = await supabaseAdmin
      .from("billing_provider_config")
      .select("stripe_trial_duration_days,stripe_trial_policy_version")
      .eq("singleton", true)
      .single();

    if (billingConfigError || !billingConfig) {
      return jsonResponse({ error: "billing_provider_config_missing" }, 503);
    }

    const configuredTrialDays = Number(billingConfig.stripe_trial_duration_days || 0);
    if (conversionPath === "trial" && (!Number.isFinite(configuredTrialDays) || configuredTrialDays <= 0)) {
      return jsonResponse({ error: "stripe_trial_config_invalid" }, 503);
    }
    const trialDurationDays = conversionPath === "trial" ? Math.round(configuredTrialDays) : 0;
    const trialPolicyVersion = String(billingConfig.stripe_trial_policy_version || "").slice(0, 80);

    const { data: localSubscription, error: localSubscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,subscription_status,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (localSubscriptionError) {
      return jsonResponse({ error: "subscription_lookup_failed" }, 500);
    }

    const liveStatuses = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
    if (localSubscription?.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(localSubscription.stripe_subscription_id);
        if (liveStatuses.has(existing.status)) {
          return jsonResponse({ error: "subscription_already_active", status: existing.status }, 409);
        }
      } catch (lookupError) {
        console.warn("[create-stripe-checkout] Falha ao consultar subscription local no Stripe", lookupError);
      }
    }

    // Buscar stripe_customer_id existente no banco para evitar duplicados no Stripe
    let stripeCustomerId: string | null = localSubscription?.stripe_customer_id || null;
    try {
      // 1. Procurar em user_addons
      const { data: addonData } = await supabaseAdmin
        .from("user_addons")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!stripeCustomerId && addonData?.stripe_customer_id) {
        stripeCustomerId = addonData.stripe_customer_id;
      } else if (!stripeCustomerId) {
        // 2. Procurar em user_subscriptions (coluna criada na migração)
        const { data: subData } = await supabaseAdmin
          .from("user_subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .not("stripe_customer_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (subData?.stripe_customer_id) {
          stripeCustomerId = subData.stripe_customer_id;
        } else {
          // 3. Procurar em payment_events
          const { data: eventData } = await supabaseAdmin
            .from("payment_events")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .not("stripe_customer_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (eventData?.stripe_customer_id) {
            stripeCustomerId = eventData.stripe_customer_id;
          }
        }
      }
    } catch (dbError) {
      console.warn("Erro ao buscar stripe_customer_id do banco:", dbError);
    }

    if (stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
          limit: 10,
        });
        const existingLive = subscriptions.data.find((subscription) => liveStatuses.has(subscription.status));
        if (existingLive) {
          return jsonResponse({ error: "subscription_already_active", status: existingLive.status }, 409);
        }
      } catch (lookupError) {
        console.warn("[create-stripe-checkout] Falha ao verificar subscriptions existentes do customer", lookupError);
      }
    }

    const checkoutMetadata = {
      user_id: user.id,
      email: user.email || "",
      user_email: user.email || "",
      plan_id: planId,
      plan_name: plan.displayName,
      plan_key: planId,
      billing_cycle: billingCycle === "annual" ? "yearly" : "monthly",
      source: String(source),
      offer_id: offerId ? String(offerId) : "",
      supabase_user_id: user.id,
      leads_limit: String(plan.leadsLimit),
      ai_limit: String(plan.aiLimit),
      is_annual: String(billingCycle === "annual"),
      conversion_path: conversionPath,
      trial_days: String(trialDurationDays),
      trial_duration_days: String(trialDurationDays),
      trial_policy_version: trialPolicyVersion,
      trial_requires_card: String(conversionPath === "trial"),
    };

    const sessionArgs: any = {
      mode: "subscription",
      allow_promotion_codes: planId === "pro",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: unitAmount,
            recurring: {
              interval: billingCycle === "annual" ? "year" : "month",
            },
            product_data: {
              name: `Zuno Propect ${plan.displayName}`,
              description: `${plan.leadsLimit} leads/mês + ${plan.aiLimit} roteiros IA/mês`,
            },
          },
        },
      ],
      success_url: `${publicSiteUrl}/prospeccao?checkout=success`,
      cancel_url: `${publicSiteUrl}/precos?checkout=cancelled`,
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: {
          ...checkoutMetadata,
          trial_type: conversionPath === "trial" ? "card_required_trial" : "none",
        },
        ...(conversionPath === "trial" ? { trial_period_days: trialDurationDays } : {}),
      },
      client_reference_id: user.id,
    };

    if (stripeCustomerId) {
      sessionArgs.customer = stripeCustomerId;
      console.log(`Reutilizando stripe_customer_id existente: ${stripeCustomerId}`);
    } else {
      sessionArgs.customer_email = user.email;
      console.log(`Nenhum stripe_customer_id encontrado, usando customer_email: ${user.email}`);
    }

    const localSubscriptionState = String(
      localSubscription?.subscription_status || localSubscription?.status || "none",
    ).toLowerCase();
    const idempotencyKey = `zuno_checkout:${user.id}:${planId}:${billingCycle}:${conversionPath}:${localSubscriptionState}`;
    const session = await stripe.checkout.sessions.create(sessionArgs, { idempotencyKey });

    console.log("Checkout session created", {
      functionName,
      sessionId: session.id,
      planId,
      billingCycle,
      unitAmount,
      conversionPath,
      trialDurationDays,
      userId: user.id,
      hasUrl: Boolean(session.url),
    });
    await logPaymentEvent(supabaseAdmin, {
      user_id: user.id,
      event_type: "checkout_started",
      provider: "stripe",
      stripe_checkout_session_id: session.id,
      plan_name: planId,
      amount: unitAmount,
      currency: "brl",
      status: session.status || "created",
      event_data: {
        billingCycle,
        checkoutUrlCreated: Boolean(session.url),
        stripeMode: getStripeMode(stripeSecretKey),
        conversion_path: conversionPath,
        trial_duration_days: trialDurationDays,
      },
    });

    return jsonResponse({
      url: session.url,
      sessionId: session.id,
      conversionPath,
      trialDurationDays,
      trialPolicyVersion,
    }, 200);
  } catch (error: any) {
    console.error("Checkout error", {
      functionName,
      message: error?.message,
      type: error?.type,
      code: error?.code,
      statusCode: error?.statusCode,
      requestId: error?.requestId,
    });

    return jsonResponse({
      error: "Não foi possível iniciar o pagamento. Tente novamente.",
      details: error?.message,
    }, error?.statusCode || 500);
  }
});
