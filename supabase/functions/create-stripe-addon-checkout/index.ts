import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ADDONS = {
  us_prospecting: {
    name: "Prospecção nos Estados Unidos",
    description: "Complemento para liberar prospecção em todos os estados dos EUA.",
    monthlyUnitAmount: 5700,
  },
} as const;

type AddonId = keyof typeof ADDONS;

const PAID_PLANS = new Set(["starter", "pro", "agency", "agencia"]);
const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
  "falecom@klsalescompany.com",
  "kiefferlinconts@gmail.com",
]);

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

function normalizeAddonId(value: unknown): AddonId | null {
  const addonId = String(value || "").trim().toLowerCase();
  return addonId === "us_prospecting" ? addonId : null;
}

function normalizePlanName(value: unknown) {
  const planName = String(value || "").trim().toLowerCase();
  if (planName === "iniciante") return "starter";
  if (planName === "agência") return "agencia";
  return planName;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || "";

  if (!stripeSecretKey) return jsonResponse({ error: "STRIPE_SECRET_KEY ausente" }, 500);
  if (!siteUrl) return jsonResponse({ error: "PUBLIC_SITE_URL ausente" }, 500);
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Supabase env ausente" }, 500);
  }

  if (!authHeader) {
    return jsonResponse({
      error: "Usuário não autenticado",
      details: "Authorization header ausente",
    }, 401);
  }

  if (!token) {
    return jsonResponse({
      error: "Usuário não autenticado",
      details: "Token ausente",
    }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const addonId = normalizeAddonId(body.addonId);

    if (!addonId) {
      return jsonResponse({ error: "addonId inválido" }, 400);
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    console.log("Addon checkout auth:", {
      hasAuthHeader: Boolean(authHeader),
      hasToken: Boolean(token),
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      addonId,
    });

    if (userError || !user) {
      return jsonResponse({
        error: "Usuário não autenticado",
        details: userError?.message || "Token inválido",
      }, 401);
    }

    const { data: adminCheck, error: adminError } = await supabaseAdmin.rpc("is_admin", { _user_id: user.id });
    if (adminError) {
      console.warn("Erro ao verificar admin no add-on checkout:", adminError.message);
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("plan_name, billing_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return jsonResponse({
        error: "Erro ao verificar plano",
        details: subscriptionError.message,
      }, 500);
    }

    const isEmailAdmin = ADMIN_EMAILS.has((user.email || "").trim().toLowerCase());
    const planName = normalizePlanName(subscription?.plan_name);
    const billingActive = !subscription?.billing_period_end || new Date(subscription.billing_period_end).getTime() > Date.now();
    const hasPaidPlan = isEmailAdmin || adminCheck === true || (PAID_PLANS.has(planName) && billingActive);

    if (!hasPaidPlan) {
      return jsonResponse({
        error: "Este complemento está disponível apenas para usuários com plano ativo.",
        details: "Escolha um plano pago antes de ativar o complemento EUA.",
      }, 403);
    }

    const { data: existingAddon, error: addonError } = await supabaseAdmin
      .from("user_addons")
      .select("status, stripe_subscription_id")
      .eq("user_id", user.id)
      .eq("addon_id", addonId)
      .maybeSingle();

    if (addonError) {
      return jsonResponse({
        error: "Erro ao verificar complemento",
        details: addonError.message,
      }, 500);
    }

    if (existingAddon?.status === "active") {
      return jsonResponse({
        error: "Complemento já ativo",
        details: "A Prospecção nos Estados Unidos já está ativa na sua conta.",
      }, 409);
    }

    const addon = ADDONS[addonId];
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const metadata = {
      user_id: user.id,
      addon_id: addonId,
      type: "addon",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: addon.monthlyUnitAmount,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: `Zuno Propect - ${addon.name}`,
              description: addon.description,
            },
          },
        },
      ],
      success_url: `${siteUrl}/prospeccao?addon=${addonId}&checkout=success`,
      cancel_url: `${siteUrl}/precos?addon=${addonId}&checkout=cancelled`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    console.log("Addon checkout session created", {
      addonId,
      userId: user.id,
      sessionId: session.id,
      hasUrl: Boolean(session.url),
    });

    return jsonResponse({ url: session.url }, 200);
  } catch (error: any) {
    console.error("Addon checkout error", {
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
