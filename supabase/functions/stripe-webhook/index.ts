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

function stripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function isAddonMetadata(metadata?: Stripe.Metadata | null) {
  return metadata?.type === "addon" && metadata?.addon_id === "us_prospecting" && Boolean(metadata?.user_id);
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
) {
  if (!userId) return;
  try {
    await supabaseAdmin.rpc("log_app_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_event_data: eventData,
      p_ip_address: null,
      p_user_agent: "stripe-webhook",
    });
  } catch (eventError) {
    console.warn("[stripe-webhook] Falha ao registrar app_event", eventError);
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

async function handlePlanCheckout(
  supabaseAdmin: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata;
  if (!metadata || !metadata.supabase_user_id) {
    console.error("Metadados ausentes no checkout session");
    return;
  }

  const userId = metadata.supabase_user_id;
  const planLimits = getPlanLimits(metadata.plan_key);
  const planName = planLimits.plan;
  const leadsLimit = planLimits.leadsLimit;
  const aiLimit = planLimits.aiLimit;
  const isAnnual = metadata.is_annual === "true";

  const now = new Date();
  const billingPeriodEnd = new Date(now);
  if (isAnnual) {
    billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
  } else {
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
  }

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      plan_name: planName,
      leads_limit: leadsLimit,
      ai_limit: aiLimit,
      is_annual: isAnnual,
      leads_used_this_month: 0,
      ai_used_this_month: 0,
      billing_period_start: now.toISOString(),
      billing_period_end: billingPeriodEnd.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

  if (error) throw error;

  await rewardReferralForPaidPlan(supabaseAdmin, userId, planName);

  console.log("Assinatura principal atualizada via Stripe", {
    userId,
    planName,
    isAnnual,
  });
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      eventUserId = metadata?.user_id || metadata?.supabase_user_id || null;
      eventPlanName = metadata?.plan_key || metadata?.plan_id || null;
      eventStatus = session.payment_status || session.status || null;
      stripeCustomerId = stripeId(session.customer);
      stripeSubscriptionId = stripeId(session.subscription);
      stripeCheckoutSessionId = session.id;
      amount = session.amount_total ?? null;
      currency = session.currency ?? null;

      if (isAddonMetadata(metadata)) {
        await upsertAddon(supabaseAdmin, {
          userId: metadata.user_id,
          addonId: metadata.addon_id,
          status: "active",
          stripeCustomerId: stripeId(session.customer),
          stripeSubscriptionId: stripeId(session.subscription),
        });

        console.log("Add-on ativado via checkout.session.completed", {
          userId: metadata.user_id,
          addonId: metadata.addon_id,
          subscriptionId: stripeId(session.subscription),
        });
      } else {
        await handlePlanCheckout(supabaseAdmin, session);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      eventUserId = subscription.metadata?.user_id || subscription.metadata?.supabase_user_id || null;
      eventPlanName = subscription.metadata?.plan_key || subscription.metadata?.plan_id || subscription.metadata?.addon_id || null;
      eventStatus = subscription.status;
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      await updateAddonFromSubscription(supabaseAdmin, subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      eventUserId = subscription.metadata?.user_id || subscription.metadata?.supabase_user_id || null;
      eventPlanName = subscription.metadata?.plan_key || subscription.metadata?.plan_id || subscription.metadata?.addon_id || null;
      eventStatus = "cancelled";
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      await updateAddonFromSubscription(supabaseAdmin, subscription, "cancelled");
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeId(invoice.subscription);
      eventStatus = event.type === "invoice.payment_failed" ? "failed" : "paid";
      stripeCustomerId = stripeId(invoice.customer);
      stripeSubscriptionId = subscriptionId;
      amount = invoice.amount_paid || invoice.amount_due || null;
      currency = invoice.currency || null;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        eventUserId = subscription.metadata?.user_id || subscription.metadata?.supabase_user_id || null;
        eventPlanName = subscription.metadata?.plan_key || subscription.metadata?.plan_id || subscription.metadata?.addon_id || null;
        await updateAddonFromSubscription(
          supabaseAdmin,
          subscription,
          event.type === "invoice.payment_failed" ? "past_due" : "active",
        );
      }
    }

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

    if (event.type === "checkout.session.completed") {
      await logAppEvent(supabaseAdmin, eventUserId, "checkout_completed", {
        stripeEventId: event.id,
        planName: eventPlanName,
        status: eventStatus,
      });
    }
  } catch (error: any) {
    console.error("Erro ao processar webhook Stripe", {
      eventType: event.type,
      message: error?.message,
    });
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
