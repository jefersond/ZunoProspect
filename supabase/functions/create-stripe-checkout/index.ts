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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const functionName = "create-stripe-checkout";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") || "";

  if (!stripeSecretKey) {
    return jsonResponse({ error: "STRIPE_SECRET_KEY ausente" }, 500);
  }

  if (!publicSiteUrl) {
    return jsonResponse({ error: "PUBLIC_SITE_URL ausente" }, 500);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "SUPABASE_URL ou SUPABASE_ANON_KEY ausente" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planId = normalizePlanId(body.planId ?? body.planKey);
    const billingCycle = normalizeBillingCycle(body.billingCycle);

    console.log("Checkout request:", {
      functionName,
      hasAuthHeader: Boolean(authHeader),
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

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.warn("Checkout unauthenticated", {
        functionName,
        hasAuthHeader: Boolean(authHeader),
        planId,
        billingCycle,
        authError: authError?.message,
      });

      return jsonResponse({ error: "Usuário não autenticado" }, 401);
    }

    console.log("Checkout authenticated:", {
      functionName,
      hasAuthHeader: Boolean(authHeader),
      planId,
      billingCycle,
      userId: user.id,
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
