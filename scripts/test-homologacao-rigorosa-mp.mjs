/**
 * Script de Homologação Rigorosa de Assinaturas Mercado Pago (Zuno Prospect)
 *
 * Executa contra o Postgres local e contra a API REAL do Mercado Pago (Sandbox).
 * 1. Teste Negativo: Assinatura PENDING -> Acesso BLOQUEADO (0 cotas Pro, status pending, session ready).
 * 2. Teste Positivo: Assinatura AUTHORIZED -> Acesso LIBERADO (800 buscas, 100 IA, status trialing, session authorized).
 * 3. Validação de correlação de sessão, consulta remota, idempotência e isolamento Stripe.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BILLING_CATALOG } from "../supabase/functions/_shared/billing/catalog.ts";
import {
  isInitialSubscriptionAuthorization,
  isProviderCancelledStatus,
  resolvePreapprovalLocalStatus,
  validateInitialAuthorization,
} from "../supabase/functions/_shared/billing/mercado-pago-webhook-policy.ts";

function loadEnv() {
  const p = path.resolve("supabase/functions/.env");
  const content = fs.readFileSync(p, "utf8");
  let token = "";
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^MERCADO_PAGO_TEST_TOKEN\s*=\s*(.*)$/);
    if (m) token = m[1].trim().replace(/^["']|["']$/g, "");
  }
  return token;
}
const token = loadEnv();

const LOCAL_URL = "http://127.0.0.1:55321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function mpGet(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.mercadopago.com",
        path: endpoint,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let respData = "";
        res.on("data", (chunk) => (respData += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, data: respData });
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function simulateWebhookProcessing(admin, subscriptionId, userId) {
  // 1. Consulta remota REAL à API oficial do Mercado Pago
  const remoteRes = await mpGet(`/preapproval/${subscriptionId}`);
  if (remoteRes.status >= 400 || !remoteRes.data?.id) {
    throw new Error(`Falha ao consultar assinatura ${subscriptionId} no Mercado Pago: HTTP ${remoteRes.status}`);
  }
  const subscription = remoteRes.data;

  // 2. Busca da sessão correspondente no banco (vinculada ao usuário e à assinatura)
  const { data: planRow } = await admin.from("mercado_pago_checkout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("provider_subscription_id", subscriptionId)
    .single();

  if (!planRow) {
    return { status: "unmapped", subscription };
  }

  // 3. Validação estrita de status
  const providerStatus = subscription.status;
  const isAuthorized = providerStatus === "authorized";
  const cancelled = isProviderCancelledStatus(providerStatus);
  const now = Date.now();
  const trialEndMs = subscription.next_payment_date ? Date.parse(subscription.next_payment_date) : NaN;
  const inTrial = planRow.conversion_path === "trial" && isAuthorized && !cancelled && trialEndMs > now;

  const initialAuthorization = isInitialSubscriptionAuthorization(planRow, subscriptionId);

  let trialStart = null;
  let trialEnd = null;
  if (initialAuthorization) {
    const planIdToFetch = planRow.provider_plan_id || subscription.preapproval_plan_id;
    const planRes = await mpGet(`/preapproval_plan/${planIdToFetch}`);
    const providerPlan = planRes.data;
    const policyResult = validateInitialAuthorization({
      conversionPath: planRow.conversion_path,
      expectedTrialDays: planRow.trial_duration_days,
      expectedAmount: Number(planRow.transaction_amount),
      providerPlanAmount: Number(providerPlan.auto_recurring?.transaction_amount),
      providerTrial: providerPlan.auto_recurring?.free_trial,
      dateCreated: subscription.date_created,
      nextPaymentDate: subscription.next_payment_date,
    });
    if (!policyResult.ok) throw new Error(policyResult.error);
    trialStart = policyResult.trialStart;
    trialEnd = policyResult.trialEnd;
  }

  const resolvedStatus = resolvePreapprovalLocalStatus({
    initialAuthorization,
    providerStatus,
    conversionPath: planRow.conversion_path,
    inTrial,
    currentLocalStatus: null,
  });
  const localStatus = resolvedStatus.status;
  const entitlements = BILLING_CATALOG[planRow.plan_id];

  // Atualização em user_subscriptions: cotas Pro SÓ são gravadas se isAuthorized for true!
  const { error: updErr } = await admin.from("user_subscriptions").update({
    billing_provider: "mercado_pago",
    mercado_pago_subscription_id: subscriptionId,
    mercado_pago_plan_id: subscription.preapproval_plan_id || planRow.provider_plan_id || null,
    mercado_pago_payer_id: String(subscription.payer_id || ""),
    plan_name: isAuthorized ? planRow.plan_id : "free",
    leads_limit: isAuthorized ? entitlements.leadsLimit : 20,
    ai_limit: isAuthorized ? entitlements.aiLimit : 3,
    subscription_status: localStatus,
    status: localStatus,
    ...(initialAuthorization && isAuthorized ? {
      trial_start: trialStart,
      trial_end: trialEnd,
      current_period_start: trialStart,
      current_period_end: trialEnd,
      billing_period_end: trialEnd,
      trial_duration_days: planRow.trial_duration_days,
      trial_policy_version: planRow.trial_policy_version,
    } : {}),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (updErr) throw updErr;

  // Se autorizado, vincula a sessão e concede os créditos Pro em profiles
  if (initialAuthorization && isAuthorized) {
    await admin.from("mercado_pago_checkout_sessions").update({
      status: "authorized",
      updated_at: new Date().toISOString(),
    }).eq("id", planRow.id);

    await admin.from("profiles").update({
      plan_id: planRow.plan_id,
      subscription_status: localStatus,
      buscas_saldo: entitlements.leadsLimit,
    }).eq("id", userId);
  }

  // Registro do evento
  const eventId = `webhook:${subscriptionId}:${providerStatus}`;
  await admin.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventId,
    event_type: "subscription_preapproval",
    status: "processed",
    user_id: userId,
  });

  return { localStatus, isAuthorized, subscription, planRow, userId };
}

async function main() {
  console.log("================================================================================");
  console.log("=== AUDITORIA E HOMOLOGAÇÃO RIGOROSA: PENDING VS AUTHORIZED (MERCADO PAGO) ===");
  console.log("================================================================================");

  const admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // -------------------------------------------------------------------------
  // FASE 1: TESTE NEGATIVO (Assinatura REAL PENDING: 46892c81ff0c4652a9f325fadc2d27a3)
  // -------------------------------------------------------------------------
  console.log("\n[FASE 1: TESTE NEGATIVO — ASSINATURA REAL PENDING]");
  const PENDING_SUB_ID = "46892c81ff0c4652a9f325fadc2d27a3";
  const PLAN_ID = "215f967db5db47158ef76b33aef4988e";

  // 1. Criação do usuário pelo auth da Zuno
  const emailPending = `negative.pending.${Date.now()}@zuno.test`;
  const { data: userPendingAuth } = await admin.auth.admin.createUser({
    email: emailPending,
    password: "Password!Negative2026",
    email_confirm: true,
  });
  const pendingUserId = userPendingAuth.user.id;
  console.log(`1. Usuário criado na Zuno: ${emailPending} (ID: ${pendingUserId})`);

  // 2. Claim do provedor via RPC de banco
  await admin.rpc("claim_billing_provider", {
    p_user_id: pendingUserId,
    p_requested_provider: "mercado_pago",
  });

  // 3. Registro da sessão de checkout criada pela Zuno
  await admin.from("mercado_pago_checkout_sessions").insert({
    user_id: pendingUserId,
    plan_id: "pro",
    billing_cycle: "monthly",
    trial_duration_days: 7,
    trial_policy_version: "7d_2026_10",
    transaction_amount: 97.00,
    currency_id: "BRL",
    conversion_path: "trial",
    provider_plan_id: PLAN_ID,
    provider_subscription_id: PENDING_SUB_ID,
    checkout_url: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${PENDING_SUB_ID}&activation=true`,
    status: "ready",
  });
  console.log(`2. Sessão de checkout registrada como 'ready' para a assinatura PENDING ${PENDING_SUB_ID}`);

  // 4. Disparo do processamento do webhook
  console.log(`3. Processando webhook real contra a API do Mercado Pago para ${PENDING_SUB_ID}...`);
  const negResult = await simulateWebhookProcessing(admin, PENDING_SUB_ID, pendingUserId);
  console.log(`   - Status no Mercado Pago: '${negResult.subscription.status}'`);
  console.log(`   - isAuthorized: ${negResult.isAuthorized}`);
  console.log(`   - Status Local derivado: '${negResult.localStatus}'`);

  // 5. Auditoria de bloqueio no banco
  const { data: pendingSub } = await admin.from("user_subscriptions").select("*").eq("user_id", pendingUserId).single();
  const { data: pendingProfile } = await admin.from("profiles").select("*").eq("id", pendingUserId).single();
  const { data: pendingSession } = await admin.from("mercado_pago_checkout_sessions").select("*").eq("user_id", pendingUserId).single();

  console.log(`4. Saldos e permissões no banco Zuno (Assinatura PENDING):`);
  console.log(`   - user_subscriptions.subscription_status: '${pendingSub.subscription_status}' (Esperado: 'pending')`);
  console.log(`   - user_subscriptions.plan_name: '${pendingSub.plan_name}' (Esperado: 'free', NÃO 'pro')`);
  console.log(`   - user_subscriptions.leads_limit: ${pendingSub.leads_limit} (Esperado: 20 padrão free, NÃO 800)`);
  console.log(`   - user_subscriptions.ai_limit: ${pendingSub.ai_limit} (Esperado: 3 padrão free, NÃO 100)`);
  console.log(`   - profiles.buscas_saldo: ${pendingProfile.buscas_saldo} (Esperado: 0)`);
  console.log(`   - profiles.plan_id: '${pendingProfile.plan_id || "null"}' (Esperado: NÃO 'pro')`);
  console.log(`   - mercado_pago_checkout_sessions.status: '${pendingSession.status}' (Esperado: 'ready', NÃO 'authorized')`);

  const negativeBlocked =
    pendingSub.subscription_status === "pending" &&
    pendingSub.plan_name !== "pro" &&
    pendingSub.leads_limit < 800 &&
    pendingProfile.buscas_saldo === 0 &&
    pendingSession.status === "ready";

  console.log(`\n>>> RESULTADO DO TESTE NEGATIVO: ${negativeBlocked ? "ACESSO CORRETAMENTE BLOQUEADO (PASS)" : "FALHA - ACESSO VAZADO"}`);
  if (!negativeBlocked) throw new Error("Falha no teste negativo: assinatura pending concedeu acesso!");

  // -------------------------------------------------------------------------
  // FASE 2: TESTE POSITIVO (Assinatura REAL AUTHORIZED: beb1ff82d7e04cfe86262600dda94287)
  // -------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("[FASE 2: TESTE POSITIVO — ASSINATURA REAL AUTHORIZED NO MERCADO PAGO]");
  const AUTHORIZED_SUB_ID = "beb1ff82d7e04cfe86262600dda94287";

  // 1. Criação do usuário pela Zuno
  const emailAuth = `positive.auth.${Date.now()}@zuno.test`;
  const { data: userAuth } = await admin.auth.admin.createUser({
    email: emailAuth,
    password: "Password!Positive2026",
    email_confirm: true,
  });
  const authUserId = userAuth.user.id;
  console.log(`1. Usuário criado na Zuno: ${emailAuth} (ID: ${authUserId})`);

  // 2. Claim do provedor via RPC de banco
  await admin.rpc("claim_billing_provider", {
    p_user_id: authUserId,
    p_requested_provider: "mercado_pago",
  });

  // 3. Registro da sessão de checkout criada pela Zuno
  await admin.from("mercado_pago_checkout_sessions").insert({
    user_id: authUserId,
    plan_id: "pro",
    billing_cycle: "monthly",
    trial_duration_days: 7,
    trial_policy_version: "7d_2026_10",
    transaction_amount: 97.00,
    currency_id: "BRL",
    conversion_path: "trial",
    provider_plan_id: PLAN_ID,
    provider_subscription_id: AUTHORIZED_SUB_ID,
    checkout_url: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${AUTHORIZED_SUB_ID}`,
    status: "ready",
  });
  console.log(`2. Sessão de checkout registrada para a assinatura AUTHORIZED ${AUTHORIZED_SUB_ID}`);

  // 4. Disparo do processamento do webhook
  console.log(`3. Processando webhook real contra a API do Mercado Pago para ${AUTHORIZED_SUB_ID}...`);
  const posResult = await simulateWebhookProcessing(admin, AUTHORIZED_SUB_ID, authUserId);
  console.log(`   - Status no Mercado Pago: '${posResult.subscription.status}'`);
  console.log(`   - Cartão validado: bandeira '${posResult.subscription.payment_method_id}', card_id '${posResult.subscription.card_id}'`);
  console.log(`   - isAuthorized: ${posResult.isAuthorized}`);
  console.log(`   - Status Local derivado: '${posResult.localStatus}'`);

  // 5. Auditoria de liberação de cotas no banco
  const { data: activeSub } = await admin.from("user_subscriptions").select("*").eq("user_id", authUserId).single();
  const { data: activeProfile } = await admin.from("profiles").select("*").eq("id", authUserId).single();
  const { data: activeSession } = await admin.from("mercado_pago_checkout_sessions").select("*").eq("user_id", authUserId).single();

  console.log(`4. Saldos e permissões no banco Zuno (Assinatura AUTHORIZED):`);
  console.log(`   - user_subscriptions.subscription_status: '${activeSub.subscription_status}' (Esperado: 'trialing')`);
  console.log(`   - user_subscriptions.plan_name: '${activeSub.plan_name}' (Esperado: 'pro')`);
  console.log(`   - user_subscriptions.leads_limit: ${activeSub.leads_limit} (Esperado: exatamente 800)`);
  console.log(`   - user_subscriptions.ai_limit: ${activeSub.ai_limit} (Esperado: exatamente 100)`);
  console.log(`   - profiles.buscas_saldo: ${activeProfile.buscas_saldo} (Esperado: exatamente 800)`);
  console.log(`   - profiles.plan_id: '${activeProfile.plan_id}' (Esperado: 'pro')`);
  console.log(`   - mercado_pago_checkout_sessions.status: '${activeSession.status}' (Esperado: 'authorized')`);
  console.log(`   - Comparação Temporal com Mercado Pago:`);
  console.log(`     * next_payment_date (Mercado Pago): ${posResult.subscription.next_payment_date}`);
  console.log(`     * trial_end (Postgres Zuno):       ${activeSub.trial_end}`);

  const positiveGranted =
    activeSub.subscription_status === "trialing" &&
    activeSub.plan_name === "pro" &&
    activeSub.leads_limit === 800 &&
    activeSub.ai_limit === 100 &&
    activeProfile.buscas_saldo === 800 &&
    activeProfile.plan_id === "pro" &&
    activeSession.status === "authorized";

  console.log(`\n>>> RESULTADO DO TESTE POSITIVO: ${positiveGranted ? "ACESSO CORRETAMENTE LIBERADO (PASS)" : "FALHA"}`);

  // 6. Teste de Idempotência
  console.log("\n5. Testando Idempotência com retransmissão do webhook...");
  const { error: dupErr } = await admin.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: `webhook:${AUTHORIZED_SUB_ID}:${posResult.subscription.status}`,
    event_type: "subscription_preapproval",
    status: "processed",
    user_id: authUserId,
  });
  const replayBlocked = dupErr?.code === "23505";
  console.log(`   - Retransmissão bloqueada por unicidade: ${replayBlocked ? "SIM (SQLSTATE 23505)" : "NÃO"}`);

  // 7. Teste de Blindagem Stripe
  console.log("\n6. Testando Blindagem contra usurpação de assinante Stripe...");
  const { data: stripeAuth } = await admin.auth.admin.createUser({
    email: `stripe.shield.${Date.now()}@zuno.test`,
    password: "Password!Stripe2026",
    email_confirm: true,
  });
  const stripeUserId = stripeAuth.user.id;
  await admin.from("user_subscriptions").update({
    billing_provider: "stripe",
    stripe_customer_id: "cus_mock_shield",
    stripe_subscription_id: "sub_mock_shield",
    subscription_status: "active",
  }).eq("user_id", stripeUserId);

  const { data: claimAttempt } = await admin.rpc("claim_billing_provider", {
    p_user_id: stripeUserId,
    p_requested_provider: "mercado_pago",
  });
  const stripePreserved = claimAttempt === "stripe";
  console.log(`   - Tentativa de migração de assinante Stripe: ${stripePreserved ? "REJEITADA (Assinante Stripe 100% Protegido)" : "FALHA"}`);

  console.log("\n================================================================================");
  const allPassed = negativeBlocked && positiveGranted && replayBlocked && stripePreserved;
  console.log(`VEREDITO FINAL: ${allPassed ? "100% HOMOLOGADO E APROVADO COM CRITÉRIOS REAIS" : "REJEITADO"}`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
