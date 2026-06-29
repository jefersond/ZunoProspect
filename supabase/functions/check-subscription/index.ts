import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limites oficiais conforme especificação
const PLAN_LIMITS: Record<string, { plan: string; leadsLimit: number; aiLimit: number }> = {
  free: { plan: "free", leadsLimit: 20, aiLimit: 3 },
  starter: { plan: "starter", leadsLimit: 300, aiLimit: 30 },
  pro: { plan: "pro", leadsLimit: 800, aiLimit: 100 },
  agency: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
  agencia: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
};

function normalizePlanDbName(planId: string): string {
  const norm = String(planId || "").toLowerCase().trim();
  if (norm === "agency" || norm === "agencia" || norm === "agência") return "agencia";
  if (norm === "starter" || norm === "iniciante") return "starter";
  if (norm === "pro") return "pro";
  return "free";
}

function resolvePlanByStripeData(
  priceId: string | null,
  amount: number | null,
  metadataPlanId: string | null
): string {
  let resolvedPlan = "pro"; // default

  // 1. Mapeamento por Price ID fixo conhecido
  const knownPrices: Record<string, string> = {
    "price_1Tazy0FgIIQ1aOHHT0IHZiH8": "pro",
  };

  if (priceId && knownPrices[priceId]) {
    resolvedPlan = knownPrices[priceId];
  } 
  // 2. Mapeamento por Valor (amount)
  else if (amount !== null) {
    const amountVal = Math.round(amount);
    if (amountVal === 4700 || amountVal === 47000 || amountVal === 47) {
      resolvedPlan = "starter";
    } else if (amountVal === 9700 || amountVal === 97000 || amountVal === 97) {
      resolvedPlan = "pro";
    } else if (amountVal === 24700 || amountVal === 247000 || amountVal === 247) {
      resolvedPlan = "agency";
    } else if (metadataPlanId) {
      resolvedPlan = metadataPlanId;
    }
  } 
  // 3. Fallback para metadados
  else if (metadataPlanId) {
    resolvedPlan = metadataPlanId;
  }

  return normalizePlanDbName(resolvedPlan);
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY não configurada no Supabase" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Configuração do Supabase ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authorization header ausente" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    logStep("Iniciando verificação de assinatura");

    // Validar token JWT do usuário no Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user || !user.email) {
      logStep("Erro de autenticação", { details: userError?.message });
      return new Response(JSON.stringify({ error: "Usuário não autenticado ou token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Usuário autenticado", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // 1. Procurar cliente no Stripe pelo e-mail do usuário
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      logStep("Nenhum cliente Stripe encontrado para este e-mail");
      return new Response(JSON.stringify({
        synchronized: false,
        message: "Nenhuma assinatura ativa encontrada no Stripe.",
        plan_name: "free",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Cliente Stripe encontrado", { customerId });

    // 2. Listar assinaturas ativas ou em trial para este cliente
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all", // Buscamos todas para poder filtrar localmente
      limit: 5,
    });

    // Filtrar assinaturas válidas (active ou trialing)
    const validSubs = subscriptions.data.filter(sub => 
      ["active", "trialing"].includes(sub.status)
    );

    if (validSubs.length === 0) {
      logStep("Nenhuma assinatura ativa ou em trial encontrada no Stripe");
      
      // Rebaixar localmente para Free se não tiver nada ativo no Stripe
      await supabaseAdmin.from("user_subscriptions").upsert({
        user_id: user.id,
        plan_name: "free",
        leads_limit: 20,
        ai_limit: 3,
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await supabaseAdmin.from("profiles").update({
        plan_id: "free",
        subscription_status: "cancelled",
        current_plan: "free",
      }).eq("id", user.id);

      return new Response(JSON.stringify({
        synchronized: true,
        message: "Nenhuma assinatura ativa encontrada no Stripe. Conta atualizada para o plano Free.",
        plan_name: "free",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assinatura válida encontrada
    const subscription = validSubs[0];
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || null;
    const metadata = subscription.metadata;

    const planName = resolvePlanByStripeData(
      priceId,
      subscriptionAmount,
      metadata?.plan_id || metadata?.plan_key || null
    );

    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.free;
    const now = new Date();
    const periodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : now.toISOString();
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
    const billingCycle = metadata?.billing_cycle || (subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly");

    logStep("Assinatura válida encontrada no Stripe", { 
      subscriptionId: subscription.id, 
      planName, 
      status: subscription.status 
    });

    // Obter limites consumidos atualmente
    const { data: existingSub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("leads_used_this_month, ai_used_this_month")
      .eq("user_id", user.id)
      .maybeSingle();

    const leadsUsed = existingSub?.leads_used_this_month ?? 0;
    const aiUsed = existingSub?.ai_used_this_month ?? 0;

    // Calcular dias de trial restantes
    let trialDaysRemaining: number | null = null;
    if (subscription.status === "trialing" && trialEnd) {
      const diff = new Date(trialEnd).getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // 3. Atualizar tabelas locais (user_subscriptions e profiles)
    const { error: subError } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        plan_name: planName,
        leads_limit: limits.leadsLimit,
        ai_limit: limits.aiLimit,
        leads_used_this_month: leadsUsed,
        ai_used_this_month: aiUsed,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        is_annual: billingCycle === "yearly" || billingCycle === "annual",
        subscription_status: subscription.status,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        billing_cycle: billingCycle,
        trial_start: trialStart,
        trial_end: trialEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });

    if (subError) {
      console.error("[check-subscription] Erro ao fazer upsert em user_subscriptions:", subError);
      throw subError;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        plan_id: planName,
        subscription_status: subscription.status,
        trial_start: trialStart,
        trial_end: trialEnd,
        trial_days_remaining: trialDaysRemaining,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_plan: planName,
      })
      .eq("id", user.id);

    if (profileError) {
      console.warn("[check-subscription] Erro ao atualizar tabela profiles:", profileError);
    }

    logStep("Banco de dados sincronizado localmente com o Stripe");

    return new Response(JSON.stringify({
      synchronized: true,
      plan_name: planName,
      status: subscription.status,
      billing_period_end: periodEnd,
      trial_end: trialEnd,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro na execução da check-subscription:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
