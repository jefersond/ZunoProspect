import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const PLAN_LIMITS: Record<string, { plan: string; leadsLimit: number; aiLimit: number }> = {
  free: { plan: "free", leadsLimit: 20, aiLimit: 3 },
  iniciante: { plan: "starter", leadsLimit: 300, aiLimit: 30 },
  starter: { plan: "starter", leadsLimit: 300, aiLimit: 30 },
  pro: { plan: "pro", leadsLimit: 800, aiLimit: 100 },
  agency: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
  agencia: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
};

function getPlanLimits(planKey: string | undefined) {
  const normalized = (planKey || "pro").trim().toLowerCase();
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS.pro;
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    
    // Extrai os metadados passados durante a criação do checkout
    const metadata = session.metadata;
    if (!metadata || !metadata.supabase_user_id) {
      console.error("Metadados ausentes no checkout session");
      return new Response("Metadados ausentes", { status: 400 });
    }

    const userId = metadata.supabase_user_id;
    const planLimits = getPlanLimits(metadata.plan_key);
    const planName = planLimits.plan;
    const leadsLimit = planLimits.leadsLimit;
    const aiLimit = planLimits.aiLimit;
    const isAnnual = metadata.is_annual === "true";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Calcular período de billing
    const now = new Date();
    const billingPeriodEnd = new Date(now);
    if (isAnnual) {
      billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
    } else {
      billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
    }

    // Verificar se já existe assinatura
    const { data: existingSub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSub) {
      // Atualizar assinatura
      await supabaseAdmin
        .from("user_subscriptions")
        .update({
          plan_name: planName,
          leads_limit: leadsLimit,
          ai_limit: aiLimit,
          is_annual: isAnnual,
          leads_used_this_month: 0,
          ai_used_this_month: 0,
          billing_period_start: now.toISOString(),
          billing_period_end: billingPeriodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);
    } else {
      // Inserir nova assinatura
      await supabaseAdmin
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          plan_name: planName,
          leads_limit: leadsLimit,
          ai_limit: aiLimit,
          is_annual: isAnnual,
          leads_used_this_month: 0,
          ai_used_this_month: 0,
          billing_period_start: now.toISOString(),
          billing_period_end: billingPeriodEnd.toISOString(),
        });
    }

    console.log(`✅ Assinatura atualizada via Stripe para usuário ${userId}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
