import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const DEFAULT_SITE_URL = "https://zunopropect.com.br";
const publicSiteUrlConfigured = Boolean(Deno.env.get("PUBLIC_SITE_URL"));
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || DEFAULT_SITE_URL).replace(/\/$/, "");

const PLANS = {
  starter: {
    name: "Starter",
    monthlyPrice: 47,
    monthlyUnitAmount: 4700,
    leadsLimit: 300,
    aiLimit: 30,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 97,
    monthlyUnitAmount: 9700,
    leadsLimit: 800,
    aiLimit: 100,
  },
  agency: {
    name: "Agency",
    monthlyPrice: 247,
    monthlyUnitAmount: 24700,
    leadsLimit: 2000,
    aiLimit: 300,
  },
} as const;

type PlanId = keyof typeof PLANS;

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
  if (planId === "agencia") return "agency";
  if (planId === "starter" || planId === "pro" || planId === "agency") return planId;

  return null;
}

function getStripeMode(secretKey: string) {
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const functionName = "create-stripe-checkout";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!stripeSecretKey) {
    console.error("Checkout configuration error", {
      functionName,
      hasStripeSecretKey: false,
      hasPublicSiteUrl: publicSiteUrlConfigured,
    });

    return jsonResponse({ error: "STRIPE_SECRET_KEY não configurada" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planId = normalizePlanId(body.planId ?? body.planKey);
    const billingCycle = String(body.billingCycle || (body.isAnual ? "annual" : "monthly")).toLowerCase();

    console.log("Checkout request received", {
      functionName,
      planId,
      rawPlan: body.planId ?? body.planKey ?? null,
      billingCycle,
      receivedPrice: body.price ?? null,
      receivedUnitAmount: body.unitAmount ?? null,
      hasStripeSecretKey: true,
      hasPublicSiteUrl: publicSiteUrlConfigured,
      siteUrl: PUBLIC_SITE_URL,
      stripeMode: getStripeMode(stripeSecretKey),
    });

    if (!planId || !PLANS[planId]) {
      return jsonResponse({ error: "Plano inválido" }, 400);
    }

    if (billingCycle !== "monthly") {
      return jsonResponse({ error: "Ciclo de cobrança inválido. Use monthly." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") || "" },
        },
      },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.warn("Checkout unauthenticated", {
        functionName,
        planId,
        authError: authError?.message,
      });

      return jsonResponse({ error: "Usuário não autenticado" }, 401);
    }

    const plan = PLANS[planId];
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
      billing_cycle: "monthly",
      is_annual: "false",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: plan.monthlyUnitAmount,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: `Zuno Propect ${plan.name}`,
              description: `${plan.leadsLimit} leads/mês + ${plan.aiLimit} roteiros IA/mês`,
            },
          },
        },
      ],
      success_url: `${PUBLIC_SITE_URL}/prospeccao?checkout=success`,
      cancel_url: `${PUBLIC_SITE_URL}/precos?checkout=cancelled`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    console.log("Checkout session created", {
      functionName,
      sessionId: session.id,
      planId,
      billingCycle: "monthly",
      unitAmount: plan.monthlyUnitAmount,
      hasUrl: Boolean(session.url),
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
      error: "Não foi possível iniciar o pagamento. Verifique sua conta ou tente novamente.",
      details: error?.message,
    }, error?.statusCode || 500);
  }
});
