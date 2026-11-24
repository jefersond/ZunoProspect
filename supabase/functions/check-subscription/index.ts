import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";
import {
  computeUsageForPeriodTransition,
  extractSubscriptionPeriod,
  selectBestStripeSubscription,
} from "../_shared/billing/stripe-renewal-sync.ts";

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

    // 1. Ler vínculo local existente antes de consultar o Stripe
    const { data: existingSub } = await supabaseAdmin
      .from("user_subscriptions")
      .select(
        "stripe_customer_id, stripe_subscription_id, stripe_price_id, leads_used_this_month, ai_used_this_month, current_period_start, current_period_end, subscription_status, last_payment_succeeded_at, last_payment_failed_at, latest_invoice_id, hosted_invoice_url"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    const candidateSubs: Stripe.Subscription[] = [];
    let resolvedCustomerId: string | null = existingSub?.stripe_customer_id || null;

    // Prioridade 1: consultar diretamente a assinatura vinculada no banco
    if (existingSub?.stripe_subscription_id) {
      try {
        const directSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
        candidateSubs.push(directSub);
        if (typeof directSub.customer === "string") {
          resolvedCustomerId = directSub.customer;
        } else if (directSub.customer && "id" in directSub.customer) {
          resolvedCustomerId = directSub.customer.id;
        }
      } catch (subErr) {
        logStep("Falha ao consultar stripe_subscription_id diretamente; seguindo para customer lookup", {
          subscriptionId: existingSub.stripe_subscription_id,
          error: subErr instanceof Error ? subErr.message : String(subErr),
        });
      }
    }

    // Prioridade 2: consultar customer vinculado e/ou todos os customers do mesmo e-mail
    const customerIdsToCheck = new Set<string>();
    if (resolvedCustomerId) customerIdsToCheck.add(resolvedCustomerId);

    const bestDirect = selectBestStripeSubscription(candidateSubs);
    if (!bestDirect) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 10,
      });
      for (const cust of customers.data) {
        customerIdsToCheck.add(cust.id);
      }

      if (customerIdsToCheck.size === 0 && candidateSubs.length === 0) {
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

      for (const cid of customerIdsToCheck) {
        try {
          const list = await stripe.subscriptions.list({
            customer: cid,
            status: "all",
            limit: 10,
          });
          for (const s of list.data) {
            if (!candidateSubs.some((existing) => existing.id === s.id)) {
              candidateSubs.push(s);
            }
          }
        } catch (listErr) {
          logStep("Falha ao listar assinaturas para customer", {
            customerId: cid,
            error: listErr instanceof Error ? listErr.message : String(listErr),
          });
        }
      }
    }

    // Seleciona a assinatura mais autoritativa (active > trialing > past_due; nunca rebaixa past_due para free)
    const subscription = selectBestStripeSubscription(candidateSubs);

    if (!subscription) {
      logStep("Nenhuma assinatura ativa, em trial ou past_due encontrada no Stripe");
      
      // Rebaixar localmente para Free apenas quando não há assinatura gerenciável no Stripe
      await supabaseAdmin.from("user_subscriptions").upsert({
        user_id: user.id,
        plan_name: "free",
        leads_limit: 20,
        ai_limit: 3,
        subscription_status: "cancelled",
        status: "cancelled",
        payment_status: "canceled",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await supabaseAdmin.from("profiles").update({
        plan_id: "free",
        subscription_status: "cancelled",
        current_plan: "free",
        payment_status: "canceled",
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

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id || resolvedCustomerId;
    const priceId = subscription.items?.data?.[0]?.price?.id || existingSub?.stripe_price_id || null;
    const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || null;
    const metadata = subscription.metadata;

    const planName = resolvePlanByStripeData(
      priceId,
      subscriptionAmount,
      metadata?.plan_id || metadata?.plan_key || null
    );

    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.free;
    const now = new Date();
    const billingCycle = metadata?.billing_cycle || (subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly");
    const period = extractSubscriptionPeriod(subscription as unknown as Record<string, unknown>, {
      billingCycle,
      now,
    });
    const periodStart = period.periodStartIso;
    const periodEnd = period.periodEndIso;
    const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;

    logStep("Assinatura gerenciável encontrada no Stripe", { 
      subscriptionId: subscription.id, 
      planName, 
      status: subscription.status,
      periodSource: period.source,
    });

    const { leadsUsed, aiUsed } = computeUsageForPeriodTransition(
      existingSub,
      periodStart,
      subscription.status,
      subscription.id,
    );

    const isActivePaid = subscription.status === "active";
    const isPastDue = subscription.status === "past_due";
    const paymentStatus = isPastDue ? "failed" : isActivePaid ? "paid" : null;
    const latestInvoiceId =
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id || existingSub?.latest_invoice_id || null;

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
        status: subscription.status,
        payment_status: paymentStatus,
        billing_provider: "stripe",
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
        latest_invoice_id: latestInvoiceId,
        hosted_invoice_url: isActivePaid ? null : (existingSub?.hosted_invoice_url ?? null),
        last_payment_failed_at: isActivePaid ? null : (existingSub?.last_payment_failed_at ?? null),
        last_payment_succeeded_at: isActivePaid ? (existingSub?.last_payment_succeeded_at ?? now.toISOString()) : (existingSub?.last_payment_succeeded_at ?? null),
        amount_remaining: isActivePaid ? 0 : undefined,
        amount_due: isActivePaid ? 0 : undefined,
        invoice_attempt_count: isActivePaid ? 0 : undefined,
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
        payment_status: paymentStatus,
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
