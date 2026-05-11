import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PLANS = {
  starter: {
    name: "Starter",
    monthlyPrice: 47,
    annualPrice: 470,
    monthlyUnitAmount: 4700,
    annualUnitAmount: 47000,
    leadsLimit: 300,
    aiLimit: 30,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 97,
    annualPrice: 970,
    monthlyUnitAmount: 9700,
    annualUnitAmount: 97000,
    leadsLimit: 800,
    aiLimit: 100,
  },
  agency: {
    name: "Agency",
    monthlyPrice: 247,
    annualPrice: 2470,
    monthlyUnitAmount: 24700,
    annualUnitAmount: 247000,
    leadsLimit: 2000,
    aiLimit: 300,
  },
} as const;

type PlanId = keyof typeof PLANS;
type BillingCycle = "monthly" | "annual";

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

function normalizePlanId(value: unknown): PlanId | null {
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
    await logAppEvent(supabaseAdmin, {
      userId: user.id,
      eventType: "checkout_started",
      eventData: { planId, billingCycle, stripeMode: getStripeMode(stripeSecretKey) },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    const plan = PLANS[planId];
    const unitAmount = billingCycle === "annual" ? plan.annualUnitAmount : plan.monthlyUnitAmount;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const metadata = {
      supabase_user_id: user.id,
      user_id: user.id,
      plan_id: planId,
      plan_key: planId,
      leads_limit: String(plan.leadsLimit),
      ai_limit: String(plan.aiLimit),
      billing_cycle: billingCycle,
      is_annual: String(billingCycle === "annual"),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: planId === "pro",
      payment_method_types: ["card"],
      customer_email: user.email,
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
              name: `Zuno Propect ${plan.name}`,
              description: `${plan.leadsLimit} leads/mês + ${plan.aiLimit} roteiros IA/mês`,
            },
          },
        },
      ],
      success_url: `${publicSiteUrl}/prospeccao?checkout=success`,
      cancel_url: `${publicSiteUrl}/precos?checkout=cancelled`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    console.log("Checkout session created", {
      functionName,
      sessionId: session.id,
      planId,
      billingCycle,
      unitAmount,
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
      },
    });

    return jsonResponse({ url: session.url }, 200);
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
