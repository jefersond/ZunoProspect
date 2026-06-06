import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Limites oficiais conforme especificação
const PLAN_LIMITS: Record<string, { plan: string; leadsLimit: number; aiLimit: number }> = {
  free: { plan: "free", leadsLimit: 20, aiLimit: 3 },
  starter: { plan: "starter", leadsLimit: 300, aiLimit: 30 },
  pro: { plan: "pro", leadsLimit: 800, aiLimit: 100 },
  agency: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
  agencia: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
};

function getPlanLimits(planKey: string | undefined) {
  const normalized = (planKey || "pro").trim().toLowerCase();
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS.pro;
}

function normalizePlanDbName(planId: string): string {
  const norm = String(planId || "").toLowerCase().trim();
  if (norm === "agency" || norm === "agencia" || norm === "agência") return "agencia";
  if (norm === "starter" || norm === "iniciante") return "starter";
  if (norm === "pro") return "pro";
  return "free";
}

function stripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function isAddonMetadata(metadata?: Stripe.Metadata | null) {
  return metadata?.type === "addon" && metadata?.addon_id === "us_prospecting" && Boolean(metadata?.user_id);
}

// Resolvedor de plano inteligente baseado em Price ID / Valor (ETAPA EXTRA - 3 e 8)
function resolvePlanByStripeData(
  priceId: string | null,
  amount: number | null,
  metadataPlanId: string | null
): { planId: string; planResolutionSource: string; hasPlanConflict: boolean; conflictDetails?: any } {
  let resolvedPlan = "pro"; // default
  let resolutionSource = "default";
  let hasConflict = false;
  let conflictDetails: any = null;

  // 1. Mapeamento por Price ID fixo conhecido ou por padrões de lookup key no Stripe (se existirem)
  const knownPrices: Record<string, string> = {
    "price_1Tazy0FgIIQ1aOHHT0IHZiH8": "pro",
  };

  if (priceId && knownPrices[priceId]) {
    resolvedPlan = knownPrices[priceId];
    resolutionSource = "stripe_price_id";
  } 
  // 2. Mapeamento por Valor (amount) - Este é o mais confiável e determinístico para preços dinâmicos!
  else if (amount !== null) {
    const amountVal = Math.round(amount);
    // Starter: R$ 47 (4700 centavos) ou R$ 470 anual (47000 centavos)
    if (amountVal === 4700 || amountVal === 47000 || amountVal === 47) {
      resolvedPlan = "starter";
      resolutionSource = "stripe_amount";
    }
    // Pro: R$ 97 (9700 centavos) ou R$ 970 anual (97000 centavos)
    else if (amountVal === 9700 || amountVal === 97000 || amountVal === 97) {
      resolvedPlan = "pro";
      resolutionSource = "stripe_amount";
    }
    // Agency: R$ 247 (24700 centavos) ou R$ 2470 anual (247000 centavos)
    else if (amountVal === 24700 || amountVal === 247000 || amountVal === 247) {
      resolvedPlan = "agency";
      resolutionSource = "stripe_amount";
    } else {
      // Se o valor não bater exatamente, usamos o metadado como fallback
      if (metadataPlanId) {
        resolvedPlan = metadataPlanId;
        resolutionSource = "stripe_metadata";
      }
    }
  } 
  // 3. Fallback para metadados
  else if (metadataPlanId) {
    resolvedPlan = metadataPlanId;
    resolutionSource = "stripe_metadata";
  }

  // Normalizar
  resolvedPlan = normalizePlanDbName(resolvedPlan);

  // Verificar se há conflito com metadados
  if (metadataPlanId) {
    const normMetadataPlan = normalizePlanDbName(metadataPlanId);
    if (resolvedPlan !== normMetadataPlan) {
      hasConflict = true;
      conflictDetails = {
        metadata_plan_id: metadataPlanId,
        stripe_price_plan_id: resolvedPlan,
        stripe_price_id: priceId,
        stripe_amount: amount,
      };
      console.warn(`[stripe-webhook] Conflito de plano detectado! Metadata: ${metadataPlanId}, Resolvido por valor/price_id: ${resolvedPlan}`);
    }
  }

  return {
    planId: resolvedPlan,
    planResolutionSource: resolutionSource,
    hasPlanConflict: hasConflict,
    conflictDetails,
  };
}

// Ativação e persistência centralizada do plano (ETAPA 4)
async function activateUserPlan(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    email?: string | null;
    planId: string;
    billingCycle?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    status: string;
  }
) {
  const normPlan = normalizePlanDbName(params.planId);
  const isCanceled = ["cancelled", "canceled", "unpaid", "incomplete_expired"].includes(params.status.toLowerCase());
  
  // Limites oficiais de limites de leads/IA
  let targetPlan = normPlan;
  let leadsLimit = 20;
  let aiLimit = 3;
  let subscriptionStatus = params.status;

  if (isCanceled) {
    targetPlan = "free";
    leadsLimit = 20;
    aiLimit = 3;
    subscriptionStatus = "cancelled";
  } else {
    if (normPlan === "starter") {
      leadsLimit = 300;
      aiLimit = 30;
    } else if (normPlan === "pro") {
      leadsLimit = 800;
      aiLimit = 100;
    } else if (normPlan === "agencia") {
      leadsLimit = 2000;
      aiLimit = 300;
    }
  }

  // Obter limites existentes para preservar o uso mensal (Não zerar créditos fora do ciclo)
  const { data: existingSub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("leads_used_this_month, ai_used_this_month")
    .eq("user_id", params.userId)
    .maybeSingle();

  const leadsUsed = existingSub?.leads_used_this_month ?? 0;
  const aiUsed = existingSub?.ai_used_this_month ?? 0;

  const now = new Date();
  const periodStart = params.currentPeriodStart || now.toISOString();
  let periodEnd = params.currentPeriodEnd;
  if (!periodEnd) {
    const end = new Date(now);
    if (params.billingCycle === "yearly" || params.billingCycle === "annual" || params.billingCycle === "year") {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    periodEnd = end.toISOString();
  }

  // Fazer o upsert da assinatura
  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: params.userId,
      plan_name: targetPlan,
      leads_limit: leadsLimit,
      ai_limit: aiLimit,
      leads_used_this_month: leadsUsed,
      ai_used_this_month: aiUsed,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      is_annual: params.billingCycle === "yearly" || params.billingCycle === "annual" || params.billingCycle === "year",
      subscription_status: subscriptionStatus,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_price_id: params.stripePriceId ?? null,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      billing_cycle: params.billingCycle || "monthly",
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

  if (error) {
    console.error("Erro ao fazer upsert em user_subscriptions:", error);
    throw error;
  }

  // Trigger do bonus de indicação (referral)
  if (!isCanceled && ["starter", "pro", "agencia"].includes(targetPlan)) {
    await rewardReferralForPaidPlan(supabaseAdmin, params.userId, targetPlan);
  }

  console.log(`[activateUserPlan] Plano ${targetPlan} ativado com sucesso para o usuário ${params.userId}. Limites - leads: ${leadsLimit}, IA: ${aiLimit}`);
}

// Pipeline de busca robusta do usuário em caso de metadados ausentes (ETAPA 5)
async function findUserByStripeData(
  supabaseAdmin: ReturnType<typeof createClient>,
  stripe: Stripe,
  params: {
    session?: Stripe.Checkout.Session | null;
    subscription?: Stripe.Subscription | null;
    customerId?: string | null;
    customerEmail?: string | null;
  }
): Promise<{ userId: string | null; email: string | null }> {
  // 1. session.metadata.user_id
  if (params.session?.metadata?.user_id) {
    const uId = params.session.metadata.user_id;
    const email = params.session.metadata.user_email || params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }
  if (params.session?.metadata?.supabase_user_id) {
    const uId = params.session.metadata.supabase_user_id;
    const email = params.session.metadata.user_email || params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }

  // 2. subscription.metadata.user_id
  if (params.subscription?.metadata?.user_id) {
    const uId = params.subscription.metadata.user_id;
    const email = params.subscription.metadata.user_email || null;
    if (uId) return { userId: uId, email };
  }
  if (params.subscription?.metadata?.supabase_user_id) {
    const uId = params.subscription.metadata.supabase_user_id;
    const email = params.subscription.metadata.user_email || null;
    if (uId) return { userId: uId, email };
  }

  // 3. session.client_reference_id
  if (params.session?.client_reference_id) {
    const uId = params.session.client_reference_id;
    const email = params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }

  // 4. stripeCustomerId já salvo no banco de dados (user_addons, user_subscriptions, ou payment_events)
  if (params.customerId) {
    // Procurar em user_addons
    const { data: addonData } = await supabaseAdmin
      .from("user_addons")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .limit(1)
      .maybeSingle();
    if (addonData?.user_id) {
      return { userId: addonData.user_id, email: null };
    }

    // Procurar em user_subscriptions
    const { data: subData } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .limit(1)
      .maybeSingle();
    if (subData?.user_id) {
      return { userId: subData.user_id, email: null };
    }

    // Procurar em payment_events
    const { data: eventData } = await supabaseAdmin
      .from("payment_events")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eventData?.user_id) {
      return { userId: eventData.user_id, email: null };
    }
  }

  // 5. Look up by email (from params or customer details)
  let emailToLookup = params.customerEmail || params.session?.customer_details?.email || params.session?.customer_email || null;
  
  if (params.customerId && !emailToLookup) {
    try {
      const customer = await stripe.customers.retrieve(params.customerId);
      if (!customer.deleted) {
        emailToLookup = customer.email;
      }
    } catch (e) {
      console.warn("Erro ao recuperar email do customer no Stripe:", e);
    }
  }

  if (emailToLookup) {
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
      const user = authData?.users?.find(u => u.email?.toLowerCase() === emailToLookup!.toLowerCase());
      if (user?.id) {
        return { userId: user.id, email: emailToLookup };
      }
    } catch (authError) {
      console.error("Erro ao listar usuários no auth admin:", authError);
    }
  }

  return { userId: null, email: emailToLookup };
}

async function upsertAddon(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    addonId: string;
    status: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  },
) {
  const now = new Date().toISOString();
  const isActive = params.status === "active";
  const { error } = await supabaseAdmin
    .from("user_addons")
    .upsert({
      user_id: params.userId,
      addon_id: params.addonId,
      status: params.status,
      provider: "stripe",
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_price_id: params.stripePriceId ?? null,
      activated_at: isActive ? now : undefined,
      cancelled_at: params.status === "cancelled" ? now : null,
      updated_at: now,
    }, { onConflict: "user_id,addon_id" });

  if (error) throw error;
}

async function logAppEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown>,
  emailFallback?: string | null,
) {
  try {
    let sourceEvent: any = null;
    let profile: any = null;
    if (userId) {
      const [eventRes, profileRes] = await Promise.all([
        supabaseAdmin
          .from("app_events")
          .select("email,anonymous_id,session_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,ref,offer")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle()
      ]);
      sourceEvent = eventRes.data;
      profile = profileRes.data;
    }

    const firstTouchObj = profile?.first_utm_source ? {
      utm_source: profile.first_utm_source,
      utm_medium: profile.first_utm_medium,
      utm_campaign: profile.first_utm_campaign,
      utm_content: profile.first_utm_content,
      referrer: profile.first_referrer,
      landing_page: profile.first_landing_page,
      seen_at: profile.first_seen_at,
      event_source_type: profile.first_event_source_type,
      creative_name: profile.first_creative_name,
    } : null;

    const lastTouchObj = profile?.last_utm_source ? {
      utm_source: profile.last_utm_source,
      utm_medium: profile.last_utm_medium,
      utm_campaign: profile.last_utm_campaign,
      utm_content: profile.last_utm_content,
      referrer: profile.last_referrer,
      landing_page: profile.last_landing_page,
      seen_at: profile.last_seen_at,
      event_source_type: profile.last_event_source_type,
      creative_name: profile.last_creative_name,
    } : null;

    const now = new Date().toISOString();
    const enrichedData = {
      ...eventData,
      first_touch: firstTouchObj,
      last_touch: lastTouchObj,
      first_utm_source: profile?.first_utm_source || null,
      first_utm_campaign: profile?.first_utm_campaign || null,
      first_utm_content: profile?.first_utm_content || null,
      first_event_source_type: profile?.first_event_source_type || null,
      last_utm_source: profile?.last_utm_source || null,
      last_utm_campaign: profile?.last_utm_campaign || null,
      last_utm_content: profile?.last_utm_content || null,
      last_event_source_type: profile?.last_event_source_type || null,
    };

    const { error } = await supabaseAdmin.from("app_events").insert({
      user_id: userId || null,
      email: sourceEvent?.email || emailFallback || eventData.email || eventData.user_email || null,
      anonymous_id: sourceEvent?.anonymous_id || null,
      session_id: sourceEvent?.session_id || null,
      event_type: eventType,
      event_name: eventType,
      event_data: enrichedData,
      metadata: enrichedData,
      ip_address: null,
      user_agent: "stripe-webhook",
      utm_source: profile?.last_utm_source || sourceEvent?.utm_source || null,
      utm_medium: profile?.last_utm_medium || sourceEvent?.utm_medium || null,
      utm_campaign: profile?.last_utm_campaign || sourceEvent?.utm_campaign || null,
      utm_content: profile?.last_utm_content || sourceEvent?.utm_content || null,
      utm_term: sourceEvent?.utm_term || null,
      fbclid: sourceEvent?.fbclid || null,
      ref: sourceEvent?.ref || null,
      offer: sourceEvent?.offer || null,
      first_touch: firstTouchObj,
      last_touch: lastTouchObj,
      created_at: now,
    });
    
    if (error) {
      console.error("[stripe-webhook] Erro ao inserir na tabela app_events:", error);
    }
  } catch (eventError) {
    console.warn("[stripe-webhook] Falha ao registrar app_event", eventError);
  }
}

async function checkDuplicatePurchaseEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  checkoutSessionId: string | null,
  subscriptionId: string | null
): Promise<boolean> {
  if (!userId) return false;
  
  try {
    let query = supabaseAdmin
      .from("app_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "purchase_completed");
      
    const conditions: string[] = [];
    if (checkoutSessionId) {
      conditions.push(`metadata->>stripe_checkout_session_id.eq.${checkoutSessionId}`);
      conditions.push(`event_data->>stripe_checkout_session_id.eq.${checkoutSessionId}`);
    }
    if (subscriptionId) {
      conditions.push(`metadata->>stripe_subscription_id.eq.${subscriptionId}`);
      conditions.push(`event_data->>stripe_subscription_id.eq.${subscriptionId}`);
    }
    
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    } else {
      return false;
    }
    
    const { data, error } = await query.limit(1);
    if (error) {
      console.warn("[stripe-webhook] Erro ao checar duplicidade de purchase event:", error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (e) {
    console.warn("[stripe-webhook] Falha ao executar checkDuplicatePurchaseEvent:", e);
    return false;
  }
}

async function logPaymentEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  try {
    await supabaseAdmin
      .from("payment_events")
      .upsert(values, { onConflict: "provider,provider_event_id" });
  } catch (eventError) {
    console.warn("[stripe-webhook] Falha ao registrar payment_event", eventError);
  }
}

async function rewardReferralForPaidPlan(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  planName: string,
) {
  if (!["starter", "iniciante", "pro", "agency", "agencia"].includes(planName)) return;

  const { error } = await supabaseAdmin.rpc("reward_referral_for_paid_plan", {
    p_referred_user_id: userId,
    p_plan_name: planName,
    p_paid_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[stripe-webhook] Falha ao liberar bonus de indicacao", {
      userId,
      planName,
      error: error.message,
    });
  }
}

async function updateAddonFromSubscription(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  statusOverride?: string,
) {
  const metadata = subscription.metadata;
  if (!isAddonMetadata(metadata)) return false;

  const status = statusOverride
    || (["active", "trialing"].includes(subscription.status) ? "active" : subscription.status);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  await upsertAddon(supabaseAdmin, {
    userId: metadata.user_id,
    addonId: metadata.addon_id,
    status,
    stripeCustomerId: stripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
  });

  console.log("Stripe add-on atualizado", {
    userId: metadata.user_id,
    addonId: metadata.addon_id,
    status,
    subscriptionId: subscription.id,
  });

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      function: "stripe-webhook",
      message: "Webhook function deployed. POST requires Stripe signature.",
      env: {
        STRIPE_WEBHOOK_SECRET: Boolean(endpointSecret),
        STRIPE_SECRET_KEY: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
      error: "Method not allowed. Use GET for health or POST for Stripe events.",
    }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({
      ok: false,
      error: "No Stripe signature. POST requires a valid Stripe-Signature header.",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    let eventUserId: string | null = null;
    let eventPlanName: string | null = null;
    let eventStatus: string | null = null;
    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let stripeCheckoutSessionId: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;

    console.log(`[stripe-webhook] Recebido evento Stripe: ${event.type} (ID: ${event.id})`);

    // 1. checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      
      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        session,
        customerId: stripeId(session.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(session.customer);
      stripeSubscriptionId = stripeId(session.subscription);
      stripeCheckoutSessionId = session.id;
      amount = session.amount_total ?? null;
      currency = session.currency ?? null;

      // RESOLVER O PLANO COM MÁXIMA SEGURANÇA
      let resolvedPriceId: string | null = null;
      if (stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          resolvedPriceId = sub.items?.data?.[0]?.price?.id || null;
        } catch (e) {
          console.warn("Erro ao buscar subscription no Stripe para obter Price ID:", e);
        }
      }

      const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
        resolvedPriceId,
        amount,
        metadata?.plan_id || metadata?.plan_key || null
      );
      
      eventPlanName = finalPlanId;
      eventStatus = session.payment_status || session.status || null;

      if (!eventUserId) {
        console.error(`[stripe-webhook] checkout.session.completed recebido sem user_id correspondente (ID do Evento: ${event.id})`);
        
        await logAppEvent(supabaseAdmin, null, "Payment_Plan_Activation_Failed", {
          stripe_event_id: event.id,
          event_type: event.type,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_checkout_session_id: stripeCheckoutSessionId,
          plan_id: finalPlanId,
          amount_total: amount,
          error_message: "Usuário não encontrado para ativação automática.",
        }, email || session.customer_details?.email || session.customer_email);
      } else {
        if (isAddonMetadata(metadata)) {
          await upsertAddon(supabaseAdmin, {
            userId: eventUserId,
            addonId: metadata.addon_id,
            status: "active",
            stripeCustomerId,
            stripeSubscriptionId,
          });
          console.log(`[stripe-webhook] Add-on ${metadata.addon_id} ativado via checkout.session.completed para o usuário ${eventUserId}`);
        } else {
          // Ativação do plano principal
          const billingCycle = metadata?.billing_cycle || "monthly";
          
          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: finalPlanId,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: resolvedPriceId,
            status: "active",
          });
          
          await logAppEvent(supabaseAdmin, eventUserId, "Payment_Plan_Activated", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: finalPlanId,
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_checkout_session_id: stripeCheckoutSessionId,
          });

          // REGISTRAR COMPRA IMEDIATAMENTE NO TEMPO REAL SE O PAGAMENTO ESTIVER CONFIRMADO
          if (eventStatus === "paid" || session.payment_status === "paid") {
            const hasDuplicate = await checkDuplicatePurchaseEvent(
              supabaseAdmin,
              eventUserId,
              stripeCheckoutSessionId,
              stripeSubscriptionId
            );

            if (!hasDuplicate) {
              await logAppEvent(supabaseAdmin, eventUserId, "purchase_completed", {
                stripe_event_id: event.id,
                stripe_checkout_session_id: stripeCheckoutSessionId,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_price_id: resolvedPriceId,
                plan_id: finalPlanId,
                plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                value: amount ? amount / 100 : 0,
                currency: currency?.toUpperCase() || "BRL",
                billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                source: "stripe_webhook",
                plan_resolution_source: planResolutionSource,
                has_plan_conflict: hasPlanConflict,
                conflict_details: conflictDetails,
              });
              console.log(`[stripe-webhook] Evento purchase_completed registrado com sucesso via checkout.session.completed para ${eventUserId}`);
            }
          }
        }
      }
    }

    // 2. customer.subscription.created e customer.subscription.updated
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata;
      
      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        subscription,
        customerId: stripeId(subscription.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || null;
      currency = subscription.items?.data?.[0]?.price?.currency || null;

      const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
        priceId,
        subscriptionAmount,
        metadata?.plan_id || metadata?.plan_key || null
      );
      
      eventPlanName = finalPlanId;
      eventStatus = subscription.status;

      if (isAddonMetadata(metadata)) {
        await updateAddonFromSubscription(supabaseAdmin, subscription);
      } else {
        if (!eventUserId) {
          console.warn(`[stripe-webhook] customer.subscription.created/updated recebido sem user_id mapeado (ID do Evento: ${event.id})`);
        } else {
          const billingCycle = metadata?.billing_cycle || "monthly";
          
          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: finalPlanId,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: priceId,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            status: subscription.status,
          });

          await logAppEvent(supabaseAdmin, eventUserId, "Subscription_Updated", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: finalPlanId,
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
          });
        }
      }
    }

    // 3. customer.subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata;

      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        subscription,
        customerId: stripeId(subscription.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      eventStatus = "cancelled";

      if (isAddonMetadata(metadata)) {
        await updateAddonFromSubscription(supabaseAdmin, subscription, "cancelled");
      } else {
        if (!eventUserId) {
          console.warn(`[stripe-webhook] customer.subscription.deleted recebido sem user_id mapeado (ID do Evento: ${event.id})`);
        } else {
          // Downgrade para Free
          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: "free",
            billingCycle: "monthly",
            stripeCustomerId,
            stripeSubscriptionId,
            status: "cancelled",
          });

          await logAppEvent(supabaseAdmin, eventUserId, "Subscription_Canceled", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: metadata?.plan_id || "free",
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
          });
        }
      }
    }

    // 4. invoice.payment_succeeded e invoice.payment_failed
    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeId(invoice.subscription);
      eventStatus = event.type === "invoice.payment_failed" ? "failed" : "paid";
      stripeCustomerId = stripeId(invoice.customer);
      stripeSubscriptionId = subscriptionId;
      stripeCheckoutSessionId = stripeId(invoice.charge) || null;
      amount = invoice.amount_paid || invoice.amount_due || null;
      currency = invoice.currency || null;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = subscription.metadata;

        const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
          subscription,
          customerId: stripeCustomerId,
        });

        eventUserId = userId;
        const priceId = subscription.items?.data?.[0]?.price?.id || null;

        const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
          priceId,
          amount,
          metadata?.plan_id || metadata?.plan_key || metadata?.addon_id || null
        );

        eventPlanName = finalPlanId;

        if (isAddonMetadata(metadata)) {
          await updateAddonFromSubscription(
            supabaseAdmin,
            subscription,
            event.type === "invoice.payment_failed" ? "past_due" : "active",
          );
        } else {
          if (!eventUserId) {
            console.warn(`[stripe-webhook] invoice event recebido sem user_id mapeado (ID do Evento: ${event.id})`);
            
            if (event.type === "invoice.payment_failed") {
              await logAppEvent(supabaseAdmin, null, "Payment_Plan_Activation_Failed", {
                stripe_event_id: event.id,
                event_type: event.type,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                error_message: "Falha de pagamento de fatura para usuário não mapeado.",
              }, email || invoice.customer_email || invoice.customer_name);
            }
          } else {
            const billingCycle = metadata?.billing_cycle || "monthly";
            const isFailed = event.type === "invoice.payment_failed";

            await activateUserPlan(supabaseAdmin, {
              userId: eventUserId,
              email,
              planId: finalPlanId,
              billingCycle,
              stripeCustomerId,
              stripeSubscriptionId,
              stripePriceId: priceId,
              currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              status: isFailed ? "past_due" : "active",
            });

            if (isFailed) {
              await logAppEvent(supabaseAdmin, eventUserId, "Invoice_Payment_Failed", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
              });
            } else {
              await logAppEvent(supabaseAdmin, eventUserId, "Payment_Plan_Activated", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
              });

              // REGISTRAR COMPRA SE NÃO TIVER SIDO REGISTRADA ANTES (GARANTE IDEMPOTÊNCIA)
              const hasDuplicate = await checkDuplicatePurchaseEvent(
                supabaseAdmin,
                eventUserId,
                null,
                stripeSubscriptionId
              );

              if (!hasDuplicate) {
                await logAppEvent(supabaseAdmin, eventUserId, "purchase_completed", {
                  stripe_event_id: event.id,
                  stripe_checkout_session_id: null,
                  stripe_customer_id: stripeCustomerId,
                  stripe_subscription_id: stripeSubscriptionId,
                  stripe_price_id: priceId,
                  plan_id: finalPlanId,
                  plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                  value: amount ? amount / 100 : 0,
                  currency: currency?.toUpperCase() || "BRL",
                  billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                  source: "stripe_webhook",
                  plan_resolution_source: planResolutionSource,
                  has_plan_conflict: hasPlanConflict,
                  conflict_details: conflictDetails,
                });
                console.log(`[stripe-webhook] Evento purchase_completed registrado com sucesso via invoice.payment_succeeded para ${eventUserId}`);
              }
            }
          }
        }
      }
    }

    // Registra todos os eventos de pagamento no banco com restrição UNIQUE de provider_event_id para idempotência
    await logPaymentEvent(supabaseAdmin, {
      user_id: eventUserId,
      event_type: event.type,
      provider: "stripe",
      provider_event_id: event.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      plan_name: eventPlanName,
      amount,
      currency,
      status: eventStatus,
      event_data: event.data.object as Record<string, unknown>,
    });
  } catch (error: any) {
    console.error("Erro ao processar webhook Stripe:", {
      eventType: event.type,
      message: error?.message,
    });
    
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
