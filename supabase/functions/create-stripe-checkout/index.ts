import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { BILLING_CATALOG, billingAmount, type BillingCycle, type BillingPlanId } from "../_shared/billing/catalog.ts";


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

function normalizePlanId(value: unknown): BillingPlanId | null {
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
    const plan = BILLING_CATALOG[planId];
    const unitAmount = billingAmount(planId, billingCycle) * 100;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const source = body.source || "upgrade";
    const offerId = body.offerId || null;
    const conversionPath = body.conversionPath === "direct_purchase" ? "direct_purchase" : "trial";

    const { data: billingConfig, error: billingConfigError } = await supabaseAdmin
      .from("billing_provider_config")
      .select("stripe_trial_duration_days,stripe_trial_policy_version,intro_offer_enabled,intro_offer_key,intro_offer_duration,intro_offer_plans")
      .eq("singleton", true)
      .single();

    if (billingConfigError || !billingConfig) {
      return jsonResponse({ error: "billing_provider_config_missing" }, 503);
    }

    const configuredTrialDays = Number(billingConfig.stripe_trial_duration_days || 0);
    if (conversionPath === "trial" && (!Number.isFinite(configuredTrialDays) || configuredTrialDays <= 0)) {
      return jsonResponse({ error: "stripe_trial_config_invalid" }, 503);
    }
    const trialDurationDays = conversionPath === "trial" ? Math.round(configuredTrialDays) : 0;
    const trialPolicyVersion = String(billingConfig.stripe_trial_policy_version || "").slice(0, 80);

    const { data: localSubscription, error: localSubscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,subscription_status,status,last_payment_succeeded_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (localSubscriptionError) {
      return jsonResponse({ error: "subscription_lookup_failed" }, 500);
    }

    const liveStatuses = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
    if (localSubscription?.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(localSubscription.stripe_subscription_id);
        if (liveStatuses.has(existing.status)) {
          return jsonResponse({ error: "subscription_already_active", status: existing.status }, 409);
        }
      } catch (lookupError) {
        console.warn("[create-stripe-checkout] Falha ao consultar subscription local no Stripe", lookupError);
      }
    }

    // Buscar stripe_customer_id existente no banco para evitar duplicados no Stripe
    let stripeCustomerId: string | null = localSubscription?.stripe_customer_id || null;
    try {
      // 1. Procurar em user_addons
      const { data: addonData } = await supabaseAdmin
        .from("user_addons")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!stripeCustomerId && addonData?.stripe_customer_id) {
        stripeCustomerId = addonData.stripe_customer_id;
      } else if (!stripeCustomerId) {
        // 2. Procurar em user_subscriptions (coluna criada na migração)
        const { data: subData } = await supabaseAdmin
          .from("user_subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .not("stripe_customer_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (subData?.stripe_customer_id) {
          stripeCustomerId = subData.stripe_customer_id;
        } else {
          // 3. Procurar em payment_events
          const { data: eventData } = await supabaseAdmin
            .from("payment_events")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .not("stripe_customer_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (eventData?.stripe_customer_id) {
            stripeCustomerId = eventData.stripe_customer_id;
          }
        }
      }
    } catch (dbError) {
      console.warn("Erro ao buscar stripe_customer_id do banco:", dbError);
    }

    if (stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
          limit: 10,
        });
        const existingLive = subscriptions.data.find((subscription) => liveStatuses.has(subscription.status));
        if (existingLive) {
          return jsonResponse({ error: "subscription_already_active", status: existingLive.status }, 409);
        }
      } catch (lookupError) {
        console.warn("[create-stripe-checkout] Falha ao verificar subscriptions existentes do customer", lookupError);
      }
    }

    const configuredIntroPlans = (billingConfig.intro_offer_plans || {}) as Record<string, {
      intro_amount_cents?: number;
      regular_amount_cents?: number;
      stripe_coupon_id?: string;
    }>;
    const configuredPlanOffer = configuredIntroPlans[planId] || {};
    const introOfferConfigured = Boolean(
      billingConfig.intro_offer_enabled
      && billingCycle === "monthly"
      && conversionPath === "direct_purchase"
      && configuredPlanOffer
    );
    const introOfferKey = String(billingConfig.intro_offer_key || "");
    const introAmountCents = Number(configuredPlanOffer.intro_amount_cents || 0);
    const regularAmountCents = Number(configuredPlanOffer.regular_amount_cents || 0);
    const introOfferDuration = String(billingConfig.intro_offer_duration || "");
    const stripeIntroCouponId = String(configuredPlanOffer.stripe_coupon_id || "");
    const hasPaidHistory = Boolean(localSubscription?.last_payment_succeeded_at);
    let introOfferApplied = false;
    let introClaim: any = null;

    if (introOfferConfigured && !hasPaidHistory) {
      if (
        !introOfferKey
        || introOfferDuration !== "first_billing_period"
        || introAmountCents <= 0
        || regularAmountCents !== unitAmount
        || introAmountCents >= regularAmountCents
        || !stripeIntroCouponId
      ) {
        return jsonResponse({ error: "intro_offer_config_invalid" }, 503);
      }

      const { data: existingClaim, error: claimLookupError } = await supabaseAdmin
        .from("billing_intro_offer_redemptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (claimLookupError) {
        return jsonResponse({ error: "intro_offer_lookup_failed" }, 500);
      }

      if (existingClaim?.status === "redeemed" || existingClaim?.redeemed_at) {
        introClaim = null;
      } else {
        introClaim = existingClaim;

        if (!introClaim) {
          const { data: insertedClaim, error: insertClaimError } = await supabaseAdmin
            .from("billing_intro_offer_redemptions")
            .insert({
              user_id: user.id,
              offer_key: introOfferKey,
              plan_id: planId,
              billing_cycle: billingCycle,
              conversion_path: conversionPath,
              billing_provider: "stripe",
              intro_amount_cents: introAmountCents,
              regular_amount_cents: regularAmountCents,
              provider_coupon_id: stripeIntroCouponId,
              provider_customer_id: stripeCustomerId,
              status: "claimed",
            })
            .select("*")
            .single();

          if (insertClaimError?.code === "23505") {
            const { data: racedClaim, error: racedClaimError } = await supabaseAdmin
              .from("billing_intro_offer_redemptions")
              .select("*")
              .eq("user_id", user.id)
              .single();
            if (racedClaimError || !racedClaim) {
              return jsonResponse({ error: "intro_offer_claim_failed" }, 409);
            }
            introClaim = racedClaim;
          } else if (insertClaimError || !insertedClaim) {
            return jsonResponse({ error: "intro_offer_claim_failed" }, 500);
          } else {
            introClaim = insertedClaim;
          }
        }

        if (introClaim?.status === "redeemed" || introClaim?.redeemed_at) {
          introClaim = null;
        } else if (!introClaim?.provider_checkout_id && String(introClaim?.plan_id || "") !== planId) {
          return jsonResponse({ error: "intro_offer_checkout_in_progress" }, 409);
        } else if (introClaim?.provider_checkout_id) {
          try {
            const previousSession = await stripe.checkout.sessions.retrieve(introClaim.provider_checkout_id);
            if (previousSession.status === "complete") {
              return jsonResponse({ error: "intro_offer_payment_pending" }, 409);
            }
            if (
              previousSession.status === "open"
              && previousSession.url
              && String(introClaim.plan_id) === planId
              && (!previousSession.expires_at || previousSession.expires_at * 1000 > Date.now())
            ) {
              return jsonResponse({
                url: previousSession.url,
                sessionId: previousSession.id,
                conversionPath,
                trialDurationDays,
                trialPolicyVersion,
                introOfferApplied: true,
                introOfferKey,
                introPrice: introAmountCents / 100,
                regularPrice: regularAmountCents / 100,
                resumed: true,
              }, 200);
            }
            if (previousSession.status === "open" && String(introClaim.plan_id) !== planId) {
              await stripe.checkout.sessions.expire(previousSession.id);
            }
          } catch (resumeError) {
            console.warn("[create-stripe-checkout] Não foi possível retomar/expirar checkout introdutório anterior", resumeError);
          }
        }

        if (introClaim) {
          const needsRefresh = Boolean(
            introClaim.provider_checkout_id
            || String(introClaim.plan_id) !== planId
            || String(introClaim.offer_key) !== introOfferKey
            || Number(introClaim.intro_amount_cents) !== introAmountCents
            || Number(introClaim.regular_amount_cents) !== regularAmountCents
          );
          if (needsRefresh) {
            const nextGeneration = Number(introClaim.claim_generation || 1) + 1;
            const { data: refreshedClaim, error: refreshClaimError } = await supabaseAdmin
              .from("billing_intro_offer_redemptions")
              .update({
                offer_key: introOfferKey,
                plan_id: planId,
                billing_cycle: billingCycle,
                conversion_path: conversionPath,
                billing_provider: "stripe",
                intro_amount_cents: introAmountCents,
                regular_amount_cents: regularAmountCents,
                provider_coupon_id: stripeIntroCouponId,
                provider_customer_id: stripeCustomerId,
                provider_checkout_id: null,
                claim_generation: nextGeneration,
                updated_at: new Date().toISOString(),
              })
              .eq("id", introClaim.id)
              .eq("status", "claimed")
              .select("*")
              .single();

            if (refreshClaimError || !refreshedClaim) {
              return jsonResponse({ error: "intro_offer_resume_failed" }, 409);
            }
            introClaim = refreshedClaim;
          }

          const coupon = await stripe.coupons.retrieve(stripeIntroCouponId);
          const expectedDiscount = regularAmountCents - introAmountCents;
          if (
            !coupon.valid
            || coupon.duration !== "once"
            || coupon.currency?.toLowerCase() !== "brl"
            || Number(coupon.amount_off || 0) !== expectedDiscount
          ) {
            return jsonResponse({ error: "stripe_intro_coupon_mismatch" }, 503);
          }

          introOfferApplied = true;
        }
      }
    }

    const checkoutMetadata = {
      user_id: user.id,
      email: user.email || "",
      user_email: user.email || "",
      plan_id: planId,
      plan_name: plan.displayName,
      plan_key: planId,
      billing_cycle: billingCycle === "annual" ? "yearly" : "monthly",
      source: String(source),
      offer_id: introOfferApplied ? introOfferKey : (offerId ? String(offerId) : ""),
      supabase_user_id: user.id,
      leads_limit: String(plan.leadsLimit),
      ai_limit: String(plan.aiLimit),
      is_annual: String(billingCycle === "annual"),
      conversion_path: conversionPath,
      trial_days: String(trialDurationDays),
      trial_duration_days: String(trialDurationDays),
      trial_policy_version: trialPolicyVersion,
      trial_requires_card: String(conversionPath === "trial"),
      intro_offer: introOfferApplied ? introOfferKey : "",
      intro_offer_applied: String(introOfferApplied),
      intro_offer_duration: introOfferApplied ? introOfferDuration : "",
      intro_price_cents: introOfferApplied ? String(introAmountCents) : "",
      regular_price_cents: introOfferApplied ? String(regularAmountCents) : String(unitAmount),
      intro_offer_claim_id: introOfferApplied && introClaim?.id ? String(introClaim.id) : "",
    };

    const sessionArgs: any = {
      mode: "subscription",
      allow_promotion_codes: planId === "pro" && !introOfferApplied,
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
              name: `Zuno Propect ${plan.displayName}`,
              description: `${plan.leadsLimit} leads/mês + ${plan.aiLimit} roteiros IA/mês`,
            },
          },
        },
      ],
      success_url: `${publicSiteUrl}/prospeccao?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicSiteUrl}/precos?checkout=cancelled`,
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: {
          ...checkoutMetadata,
          trial_type: conversionPath === "trial" ? "card_required_trial" : "none",
        },
        ...(conversionPath === "trial" ? { trial_period_days: trialDurationDays } : {}),
      },
      client_reference_id: user.id,
      ...(introOfferApplied ? { discounts: [{ coupon: stripeIntroCouponId }] } : {}),
    };

    if (stripeCustomerId) {
      sessionArgs.customer = stripeCustomerId;
      console.log(`Reutilizando stripe_customer_id existente: ${stripeCustomerId}`);
    } else {
      sessionArgs.customer_email = user.email;
      console.log(`Nenhum stripe_customer_id encontrado, usando customer_email: ${user.email}`);
    }

    const localSubscriptionState = String(
      localSubscription?.subscription_status || localSubscription?.status || "none",
    ).toLowerCase();
    const idempotencyKey = introOfferApplied && introClaim?.id
      ? `zuno_intro_checkout:${user.id}:${introClaim.id}:${introClaim.claim_generation || 1}`
      : `zuno_checkout:${user.id}:${planId}:${billingCycle}:${conversionPath}:${localSubscriptionState}:${localSubscription?.stripe_subscription_id || "none"}`;
    const session = await stripe.checkout.sessions.create(sessionArgs, { idempotencyKey });

    if (introOfferApplied && introClaim?.id) {
      const { error: claimUpdateError } = await supabaseAdmin
        .from("billing_intro_offer_redemptions")
        .update({
          provider_checkout_id: session.id,
          provider_customer_id: stripeCustomerId,
          last_checkout_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", introClaim.id)
        .eq("status", "claimed");

      if (claimUpdateError) {
        console.warn("[create-stripe-checkout] Checkout criado, mas claim introdutório não atualizou", claimUpdateError);
      }
    }

    console.log("Checkout session created", {
      functionName,
      sessionId: session.id,
      planId,
      billingCycle,
      unitAmount,
      amountToday: introOfferApplied ? introAmountCents : unitAmount,
      conversionPath,
      introOfferApplied,
      trialDurationDays,
      userId: user.id,
      hasUrl: Boolean(session.url),
    });
    await logPaymentEvent(supabaseAdmin, {
      user_id: user.id,
      event_type: "checkout_started",
      provider: "stripe",
      stripe_checkout_session_id: session.id,
      plan_name: planId,
      amount: introOfferApplied ? introAmountCents : unitAmount,
      currency: "brl",
      status: session.status || "created",
      event_data: {
        billingCycle,
        checkoutUrlCreated: Boolean(session.url),
        stripeMode: getStripeMode(stripeSecretKey),
        conversion_path: conversionPath,
        trial_duration_days: trialDurationDays,
        intro_offer: introOfferApplied ? introOfferKey : null,
        intro_offer_applied: introOfferApplied,
        intro_price: introOfferApplied ? introAmountCents / 100 : null,
        regular_price: unitAmount / 100,
      },
    });

    return jsonResponse({
      url: session.url,
      sessionId: session.id,
      conversionPath,
      trialDurationDays,
      trialPolicyVersion,
      introOfferApplied,
      introOfferKey: introOfferApplied ? introOfferKey : null,
      introPrice: introOfferApplied ? introAmountCents / 100 : null,
      regularPrice: unitAmount / 100,
    }, 200);
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
