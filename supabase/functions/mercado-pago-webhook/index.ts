import { createClient } from "npm:@supabase/supabase-js@2";
import { BILLING_CATALOG, type BillingPlanId } from "../_shared/billing/catalog.ts";
import { emitZanotelliProductEvent, type ZanotelliProductEventName } from "../_shared/zanotelli-inbound-bridge.ts";

const MP_API = "https://api.mercadopago.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeString(value: unknown, max = 200) {
  return typeof value === "string" ? value.slice(0, max) : value == null ? "" : String(value).slice(0, max);
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeHexEqual(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validateSignature(req: Request, dataId: string, secret: string) {
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const pairs = Object.fromEntries(signature.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  const ts = safeString(pairs.ts, 40);
  const v1 = safeString(pairs.v1, 128).toLowerCase();
  if (!ts || !v1) return false;

  const manifest = [
    dataId ? `id:${dataId};` : "",
    requestId ? `request-id:${requestId};` : "",
    ts ? `ts:${ts};` : "",
  ].join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return timingSafeHexEqual(hex(digest), v1);
}

async function mpGet(token: string, path: string) {
  const response = await fetch(`${MP_API}${path}`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`mercado_pago_fetch_${response.status}`);
  return payload;
}

async function mpPut(token: string, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${MP_API}${path}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`mercado_pago_update_${response.status}`);
  return payload;
}

function canonicalFailureReason(raw: string | null) {
  if (!raw) return null;
  if (["cc_rejected_insufficient_amount", "insufficient_amount"].includes(raw)) return "insufficient_funds";
  if ([
    "cc_rejected_call_for_authorize",
    "cc_rejected_card_disabled",
    "rejected_by_bank",
    "cc_rejected_3ds_challenge",
    "cc_rejected_3ds_mandatory",
  ].includes(raw)) return "card_declined";
  if (["cc_rejected_other_reason", "rejected_other_reason"].includes(raw)) return "generic_decline";
  return "other";
}

function validPlan(value: unknown): value is BillingPlanId {
  return ["starter", "pro", "agency"].includes(String(value));
}

function providerEventId(body: Record<string, unknown>, type: string, action: string, dataId: string) {
  const webhookId = body.id;
  return webhookId != null
    ? `webhook:${safeString(webhookId, 120)}`
    : `${type}:${action}:${dataId}`;
}

Deno.serve(async (req) => {
  if (req.method === "GET") return json({ ok: true, function: "mercado-pago-webhook" });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!accessToken || !webhookSecret || !supabaseUrl || !serviceRole) {
    return json({ error: "mercado_pago_webhook_not_configured" }, 503);
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({})) as Record<string, any>;
  const dataId = safeString(url.searchParams.get("data.id") || body?.data?.id, 160);
  const type = safeString(url.searchParams.get("type") || body?.type, 100);
  const action = safeString(body?.action, 120);

  if (!dataId || !type) return json({ error: "invalid_notification" }, 400);
  if (!(await validateSignature(req, dataId, webhookSecret))) return json({ error: "invalid_signature" }, 401);

  const supported = new Set(["subscription_preapproval", "subscription_authorized_payment", "payment"]);
  if (!supported.has(type)) return json({ ok: true, ignored: true }, 200);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const eventId = providerEventId(body, type, action, dataId);

  const { data: seen } = await admin
    .from("payment_events")
    .select("id,status")
    .eq("provider", "mercado_pago")
    .eq("provider_event_id", eventId)
    .maybeSingle();

  if (seen?.id && seen.status === "processed") return json({ ok: true, duplicate: true }, 200);

  const persistPaymentEvent = async (values: Record<string, unknown>) => {
    const { error } = await admin.from("payment_events").upsert({
      event_type: type,
      provider: "mercado_pago",
      provider_event_id: eventId,
      event_data: { action, data_id: dataId, live_mode: body?.live_mode ?? null, ...values },
      status: "processed",
      ...values,
    }, { onConflict: "provider,provider_event_id" });
    if (error) throw error;
  };

  const canonicalEvent = async (
    userId: string,
    eventName: string,
    data: Record<string, unknown>,
    referenceId: string,
  ) => {
    const dedupeKey = `${eventName}:mercado_pago:${referenceId}`;
    const eventData = {
      ...data,
      billing_provider: "mercado_pago",
    };
    const { error } = await admin.from("app_events").insert({
      user_id: userId,
      event_type: eventName,
      event_name: eventName,
      event_data: eventData,
      metadata: eventData,
      event_source_type: "billing",
      is_internal_event: false,
      user_agent: "mercado-pago-webhook",
      dedupe_key: dedupeKey,
    });
    const inserted = !error;
    if (error && error.code !== "23505") throw error;

    if (inserted && [
      "card_added",
      "trial_started",
      "trial_converted_to_paid",
      "trial_cancelled",
      "subscription_cancelled",
      "payment_failed",
    ].includes(eventName)) {
      void emitZanotelliProductEvent({
        eventName: eventName as ZanotelliProductEventName,
        eventId: dedupeKey,
        userId,
        planId: safeString(data.plan_id, 30) || null,
        trialEnd: safeString(data.trial_end, 60) || null,
      }).catch(() => undefined);
    }
  };

  const lookupByPlan = async (providerPlanId: string) => {
    const { data } = await admin.from("mercado_pago_checkout_plans")
      .select("user_id,plan_id,billing_cycle,trial_duration_days,trial_policy_version,transaction_amount,currency_id,provider_plan_id")
      .eq("provider_plan_id", providerPlanId)
      .maybeSingle();
    return data;
  };

  const resolveSubscriptionContext = async (subscription: Record<string, any>) => {
    const providerPlanId = safeString(subscription.preapproval_plan_id, 160);
    const planRow = providerPlanId ? await lookupByPlan(providerPlanId) : null;
    if (!planRow?.user_id || !validPlan(planRow.plan_id)) return null;
    return { subscription, planRow };
  };

  const enforceMpProvider = async (userId: string, incomingSubscriptionId: string) => {
    const { data: claimed, error } = await admin.rpc("claim_billing_provider", {
      p_user_id: userId,
      p_requested_provider: "mercado_pago",
    });
    if (error || claimed !== "mercado_pago") {
      try { await mpPut(accessToken, `/preapproval/${incomingSubscriptionId}`, { status: "canceled" }); } catch {}
      throw new Error("billing_provider_conflict");
    }

    const { data: row } = await admin.from("user_subscriptions")
      .select("mercado_pago_subscription_id,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId)
      .single();

    if (row?.stripe_customer_id || row?.stripe_subscription_id) {
      try { await mpPut(accessToken, `/preapproval/${incomingSubscriptionId}`, { status: "canceled" }); } catch {}
      throw new Error("stripe_relationship_exists");
    }
    if (row?.mercado_pago_subscription_id && row.mercado_pago_subscription_id !== incomingSubscriptionId) {
      try { await mpPut(accessToken, `/preapproval/${incomingSubscriptionId}`, { status: "canceled" }); } catch {}
      throw new Error("duplicate_mercado_pago_subscription");
    }
  };

  try {
    if (type === "subscription_preapproval") {
      const subscription = await mpGet(accessToken, `/preapproval/${encodeURIComponent(dataId)}`);
      const context = await resolveSubscriptionContext(subscription);
      if (!context) {
        await persistPaymentEvent({ status: "unmapped", event_data: { action, data_id: dataId, raw_status: subscription?.status ?? null } });
        return json({ ok: true, mapped: false }, 200);
      }

      const { planRow } = context;
      const userId = planRow.user_id as string;
      await enforceMpProvider(userId, safeString(subscription.id, 160));

      const providerPlan = await mpGet(accessToken, `/preapproval_plan/${encodeURIComponent(planRow.provider_plan_id)}`);
      const providerTrial = providerPlan?.auto_recurring?.free_trial;
      const expectedDays = Number(planRow.trial_duration_days);
      const providerTrialOk = providerTrial
        && Number(providerTrial.frequency) === expectedDays
        && providerTrial.frequency_type === "days";

      if (!providerTrialOk) {
        try { await mpPut(accessToken, `/preapproval/${encodeURIComponent(subscription.id)}`, { status: "canceled" }); } catch {}
        throw new Error("mercado_pago_trial_policy_mismatch");
      }

      const trialStart = safeString(subscription.date_created, 60) || null;
      const trialEnd = safeString(subscription.next_payment_date, 60) || null;
      const trialStartMs = trialStart ? Date.parse(trialStart) : NaN;
      const trialEndMs = trialEnd ? Date.parse(trialEnd) : NaN;
      const trialDurationMs = Number.isFinite(trialStartMs) && Number.isFinite(trialEndMs)
        ? trialEndMs - trialStartMs
        : NaN;
      const expectedMs = expectedDays * 86_400_000;
      const providerDatesOk = Number.isFinite(trialDurationMs)
        && Math.abs(trialDurationMs - expectedMs) <= 15 * 60_000;

      if (!providerDatesOk) {
        try { await mpPut(accessToken, `/preapproval/${encodeURIComponent(subscription.id)}`, { status: "canceled" }); } catch {}
        throw new Error("mercado_pago_trial_end_mismatch");
      }

      const providerStatus = safeString(subscription.status, 50);
      const cancelled = providerStatus === "canceled" || providerStatus === "cancelled";
      const now = Date.now();
      const inTrial = !cancelled && trialEndMs > now;
      const localStatus = cancelled ? "cancelled" : inTrial ? "trialing" : providerStatus === "authorized" ? "active" : providerStatus;
      const entitlements = BILLING_CATALOG[planRow.plan_id as BillingPlanId];

      const { error: updateError } = await admin.from("user_subscriptions").update({
        billing_provider: "mercado_pago",
        mercado_pago_subscription_id: safeString(subscription.id, 160),
        mercado_pago_plan_id: safeString(subscription.preapproval_plan_id, 160),
        mercado_pago_payer_id: safeString(subscription.payer_id, 160) || null,
        plan_name: planRow.plan_id,
        billing_cycle: planRow.billing_cycle,
        is_annual: planRow.billing_cycle === "annual",
        leads_limit: entitlements.leadsLimit,
        ai_limit: entitlements.aiLimit,
        subscription_status: localStatus,
        status: localStatus,
        trial_start: trialStart,
        trial_end: trialEnd,
        current_period_start: trialStart,
        current_period_end: trialEnd,
        billing_period_end: trialEnd,
        trial_duration_days: expectedDays,
        trial_policy_version: planRow.trial_policy_version,
        cancel_at_period_end: false,
        canceled_at: cancelled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("billing_provider", "mercado_pago");
      if (updateError) throw updateError;

      const common = {
        plan_id: planRow.plan_id,
        billing_cycle: planRow.billing_cycle,
        mercado_pago_subscription_id: safeString(subscription.id, 160),
        mercado_pago_plan_id: safeString(subscription.preapproval_plan_id, 160),
        trial_start: trialStart,
        trial_end: trialEnd,
        trial_duration_days: expectedDays,
        trial_policy_version: planRow.trial_policy_version,
        provider_status: providerStatus,
      };

      if (!cancelled && inTrial) {
        if (subscription.card_id) {
          await canonicalEvent(userId, "card_added", common, safeString(subscription.id, 160));
        }
        await canonicalEvent(userId, "trial_started", common, safeString(subscription.id, 160));
      }

      if (cancelled) {
        await canonicalEvent(userId, "subscription_cancelled", common, safeString(subscription.id, 160));
        if (trialEndMs > Date.now()) {
          await canonicalEvent(userId, "trial_cancelled", common, safeString(subscription.id, 160));
        }
      }

      await persistPaymentEvent({
        user_id: userId,
        status: "processed",
        event_data: { action, data_id: dataId, provider_status: providerStatus, subscription_id: subscription.id },
      });
      return json({ ok: true }, 200);
    }

    let authorizedPayment: Record<string, any>;
    if (type === "subscription_authorized_payment") {
      authorizedPayment = await mpGet(accessToken, `/authorized_payments/${encodeURIComponent(dataId)}`);
    } else {
      const payment = await mpGet(accessToken, `/v1/payments/${encodeURIComponent(dataId)}`);
      const preapprovalId = safeString(payment?.metadata?.preapproval_id, 160);
      if (!preapprovalId) {
        await persistPaymentEvent({ status: "unmapped", event_data: { action, data_id: dataId, raw_status: payment?.status ?? null } });
        return json({ ok: true, mapped: false }, 200);
      }
      authorizedPayment = {
        id: payment.id,
        preapproval_id: preapprovalId,
        date_created: payment.date_created,
        debit_date: payment.date_approved || payment.date_created,
        retry_attempt: 0,
        transaction_amount: payment.transaction_amount,
        currency_id: payment.currency_id,
        payment: { id: payment.id, status: payment.status, status_detail: payment.status_detail },
      };
    }

    const subscriptionId = safeString(authorizedPayment.preapproval_id, 160);
    if (!subscriptionId) throw new Error("mercado_pago_payment_without_subscription");

    const subscription = await mpGet(accessToken, `/preapproval/${encodeURIComponent(subscriptionId)}`);
    const context = await resolveSubscriptionContext(subscription);
    if (!context) {
      await persistPaymentEvent({ status: "unmapped", event_data: { action, data_id: dataId, subscription_id: subscriptionId } });
      return json({ ok: true, mapped: false }, 200);
    }

    const userId = context.planRow.user_id as string;
    await enforceMpProvider(userId, subscriptionId);

    const { data: local } = await admin.from("user_subscriptions")
      .select("subscription_status,status,trial_end,trial_start,plan_name,billing_cycle,trial_duration_days,trial_policy_version")
      .eq("user_id", userId)
      .single();

    const payment = authorizedPayment.payment || {};
    const paymentStatus = safeString(payment.status || authorizedPayment.status, 80);
    const rawStatusDetail = safeString(payment.status_detail, 160) || null;
    const paymentId = safeString(payment.id || authorizedPayment.id, 160);
    const approved = paymentStatus === "approved";
    const rejected = paymentStatus === "rejected" || authorizedPayment.status === "rejected";
    const common = {
      plan_id: context.planRow.plan_id,
      billing_cycle: context.planRow.billing_cycle,
      mercado_pago_subscription_id: subscriptionId,
      provider_payment_id: paymentId || null,
      provider_invoice_id: safeString(authorizedPayment.id, 160),
      provider_status: paymentStatus,
      provider_status_detail: rawStatusDetail,
      retry_attempt: Number(authorizedPayment.retry_attempt || 0),
      amount: Number(authorizedPayment.transaction_amount || 0),
      currency: safeString(authorizedPayment.currency_id, 10) || "BRL",
      trial_start: local?.trial_start ?? null,
      trial_end: local?.trial_end ?? null,
      trial_duration_days: local?.trial_duration_days ?? context.planRow.trial_duration_days,
      trial_policy_version: local?.trial_policy_version ?? context.planRow.trial_policy_version,
    };

    if (approved) {
      const trialEndMs = local?.trial_end ? Date.parse(local.trial_end) : NaN;
      const paidAtMs = Date.parse(safeString(authorizedPayment.debit_date || authorizedPayment.date_created, 60));
      const conversion = String(local?.subscription_status || local?.status) === "trialing"
        && Number.isFinite(trialEndMs)
        && Number.isFinite(paidAtMs)
        && paidAtMs >= trialEndMs - 15 * 60_000;

      await admin.from("user_subscriptions").update({
        payment_status: "paid",
        last_payment_succeeded_at: new Date().toISOString(),
        latest_invoice_id: safeString(authorizedPayment.id, 160),
        amount_remaining: 0,
        amount_due: 0,
        invoice_attempt_count: Number(authorizedPayment.retry_attempt || 0) + 1,
        ...(conversion ? { subscription_status: "active", status: "active" } : {}),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("billing_provider", "mercado_pago");

      await canonicalEvent(userId, "purchase_completed", common, paymentId || safeString(authorizedPayment.id, 160));
      if (conversion) {
        await canonicalEvent(userId, "trial_converted_to_paid", common, subscriptionId);
      }
    } else if (rejected) {
      const reason = canonicalFailureReason(rawStatusDetail);
      await admin.from("user_subscriptions").update({
        payment_status: "failed",
        subscription_status: "past_due",
        status: "past_due",
        last_payment_failed_at: new Date().toISOString(),
        latest_invoice_id: safeString(authorizedPayment.id, 160),
        amount_due: Math.round(Number(authorizedPayment.transaction_amount || 0) * 100),
        amount_remaining: Math.round(Number(authorizedPayment.transaction_amount || 0) * 100),
        invoice_attempt_count: Number(authorizedPayment.retry_attempt || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("billing_provider", "mercado_pago");

      await canonicalEvent(userId, "payment_failed", {
        ...common,
        failure_reason: reason,
        provider_failure_code: rawStatusDetail,
      }, paymentId || safeString(authorizedPayment.id, 160));
    }

    await persistPaymentEvent({
      user_id: userId,
      status: "processed",
      event_data: {
        action,
        data_id: dataId,
        subscription_id: subscriptionId,
        payment_status: paymentStatus,
        status_detail: rawStatusDetail,
        retry_attempt: Number(authorizedPayment.retry_attempt || 0),
      },
    });
    return json({ ok: true }, 200);
  } catch (error) {
    const message = safeString((error as Error)?.message, 180) || "mercado_pago_webhook_failed";
    try {
      await admin.from("payment_events").upsert({
        event_type: type,
        provider: "mercado_pago",
        provider_event_id: eventId,
        event_data: { action, data_id: dataId, error: message },
        status: "failed",
      }, { onConflict: "provider,provider_event_id" });
    } catch {}
    return json({ error: message }, 500);
  }
});
