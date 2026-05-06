import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://zunopropect.com.br").replace(/\/$/, "");
const VALID_PLANS = new Set(["iniciante", "starter", "pro", "agencia"]);
const BASE_PRICE: Record<string, number> = {
  starter: 47,
  pro: 97,
  agencia: 147,
};
const PLAN_LIMITS: Record<string, { planKey: string; leadsLimit: number; aiLimit: number }> = {
  iniciante: { planKey: "starter", leadsLimit: 300, aiLimit: 30 },
  starter: { planKey: "starter", leadsLimit: 300, aiLimit: 30 },
  pro: { planKey: "pro", leadsLimit: 800, aiLimit: 100 },
  agencia: { planKey: "agencia", leadsLimit: 2000, aiLimit: 300 },
};
const INCREMENT_LEADS = 50;
const INCREMENT_PRICE = 23.5;
const MIN_LEADS = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePlanKey(planKey: unknown) {
  const key = String(planKey || "").trim().toLowerCase();
  if (key === "iniciante") return "starter";
  if (key === "agency") return "agencia";
  return key;
}

function calculatePrice(planKey: string, leadsQty: number, isAnual: boolean) {
  const basePrice = BASE_PRICE[planKey];
  if (!basePrice) return Number.NaN;

  const leadsAboveBase = Math.max(0, leadsQty - MIN_LEADS);
  const increments = leadsAboveBase / INCREMENT_LEADS;
  const monthlyPrice = basePrice + (increments * INCREMENT_PRICE);

  return isAnual ? Math.round(monthlyPrice * 10) : Math.round(monthlyPrice * 100) / 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Usuario nao autenticado");

    const body = await req.json();
    const planKey = normalizePlanKey(body.planKey);
    const planLimits = PLAN_LIMITS[planKey];
    const requestedLeadsQty = Number(body.leadsQty || planLimits?.leadsLimit || 300);
    const leadsQty = planLimits?.leadsLimit ?? requestedLeadsQty;
    const isAnual = Boolean(body.isAnual);
    const billingCycle = isAnual ? "annual" : "monthly";

    console.log("Checkout request", {
      planKey,
      requestedLeadsQty,
      leadsQty,
      billingCycle,
      userId: user.id,
      publicSiteUrl: PUBLIC_SITE_URL,
      priceId: null,
    });

    if (!VALID_PLANS.has(planKey)) {
      throw new Error("Plano invalido para checkout");
    }

    if (!Number.isFinite(leadsQty) || leadsQty <= 0 || !planLimits) {
      throw new Error("Quantidade de leads invalida para checkout");
    }

    const { data: pricingTier, error: pricingError } = await supabaseClient
      .from("lead_pricing_tiers")
      .select("price_monthly, price_annual")
      .eq("plan_name", planKey)
      .eq("leads_quantity", leadsQty)
      .eq("active", true)
      .maybeSingle();

    if (pricingError) {
      console.warn("Erro ao buscar preco em lead_pricing_tiers; usando fallback", {
        message: pricingError.message,
        planKey,
        leadsQty,
      });
    }

    const dbPrice = pricingTier
      ? Number(isAnual ? pricingTier.price_annual : pricingTier.price_monthly)
      : Number.NaN;
    const price = Number.isFinite(dbPrice) ? dbPrice : calculatePrice(planKey, leadsQty, isAnual);
    if (!Number.isFinite(price) || Number.isNaN(price)) {
      throw new Error("Preco invalido para o plano selecionado.");
    }

    const leadsLimit = leadsQty;
    const aiLimit = planLimits.aiLimit;
    const unitAmount = Math.round(price * 100);

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Zuno Prospect - Plano ${planKey.toUpperCase()} (${leadsQty} leads)`,
              description: `${leadsLimit} leads e ${aiLimit} analises com IA por mes - ${isAnual ? "Anual" : "Mensal"}`,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: isAnual ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${PUBLIC_SITE_URL}/prospeccao?checkout=success`,
      cancel_url: `${PUBLIC_SITE_URL}/precos?checkout=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        user_id: user.id,
        plan_key: planKey,
        leads_qty: String(leadsQty),
        leads_limit: String(leadsLimit),
        ai_limit: String(aiLimit),
        is_annual: String(!!isAnual),
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          user_id: user.id,
          plan_key: planKey,
          leads_limit: String(leadsLimit),
          ai_limit: String(aiLimit),
          is_annual: String(!!isAnual),
        },
      },
    });

    console.log("Checkout session created", {
      sessionId: session.id,
      planKey,
      leadsQty,
      billingCycle,
      unitAmount,
      hasUrl: Boolean(session.url),
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Checkout error", {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      statusCode: error?.statusCode,
      requestId: error?.requestId,
    });

    return new Response(
      JSON.stringify({
        error: "Falha ao criar checkout",
        details: error.message,
        status: error?.statusCode,
        stripeCode: error?.code,
        stripeType: error?.type,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error?.statusCode || 500,
      }
    );
  }
});
