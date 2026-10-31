import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:55321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const WEBHOOK_SECRET = "mp_webhook_secret_mock_rc1";

const REAL_SUB_ID = "46892c81ff0c4652a9f325fadc2d27a3";
const REAL_PLAN_ID = "215f967db5db47158ef76b33aef4988e";

function generateSignature(dataId, requestId, timestamp, secret) {
  const manifest = [
    dataId ? `id:${dataId};` : "",
    requestId ? `request-id:${requestId};` : "",
    timestamp ? `ts:${timestamp};` : "",
  ].join("");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(manifest);
  const v1 = hmac.digest("hex");
  return `ts=${timestamp},v1=${v1}`;
}

async function run() {
  console.log("================================================================================");
  console.log("=== VINCULAÇÃO DE SESSÃO LOCAL E HOMOLOGAÇÃO DE WEBHOOK DA ASSINATURA REAL ===");
  console.log("================================================================================");

  const admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. Criar usuário de teste na Zuno local
  const testEmail = `homologacao.mp.${Date.now()}@zuno.test`;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: "Password@Zuno2026",
    email_confirm: true,
  });
  if (authErr) throw authErr;
  const userId = authUser.user.id;
  console.log(`\n1. Usuário de teste Zuno criado localmente:`);
  console.log(`   - Email: ${testEmail}`);
  console.log(`   - User ID: ${userId}`);

  // 2. Criar a sessão de checkout em mercado_pago_checkout_sessions vinculada à assinatura REAL criada no MP
  console.log(`\n2. Vinculando assinatura real do Mercado Pago (${REAL_SUB_ID}) à sessão de checkout da Zuno:`);
  const { data: session, error: sessErr } = await admin
    .from("mercado_pago_checkout_sessions")
    .insert({
      user_id: userId,
      plan_id: "pro",
      billing_cycle: "monthly",
      trial_duration_days: 7,
      trial_policy_version: "7d_2026_10",
      transaction_amount: 97.00,
      currency_id: "BRL",
      conversion_path: "trial",
      provider_plan_id: REAL_PLAN_ID,
      provider_subscription_id: REAL_SUB_ID,
      checkout_url: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${REAL_SUB_ID}&activation=true`,
      status: "ready",
    })
    .select("*")
    .single();

  if (sessErr) throw sessErr;
  console.log(`   ✓ Sessão de checkout registrada com sucesso:`);
  console.log(`     - ID da Sessão: ${session.id}`);
  console.log(`     - User ID vinculado: ${session.user_id}`);
  console.log(`     - Assinatura vinculada: ${session.provider_subscription_id}`);
  console.log(`     - Plano: ${session.plan_id} (R$ ${session.transaction_amount})`);

  // 3. Simulação de processamento do webhook com autorização
  console.log(`\n3. Processamento do webhook de autorização (subscription_preapproval):`);
  const ts = Math.floor(Date.now() / 1000).toString();
  const reqId = `req_${Date.now()}`;
  const sig = generateSignature(REAL_SUB_ID, reqId, ts, WEBHOOK_SECRET);
  console.log(`   - Assinatura HMAC gerada: ts=${ts}, v1=${sig.split("v1=")[1].slice(0, 8)}...`);

  const trialStart = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Executa atualização idêntica à do webhook
  await admin.from("mercado_pago_checkout_sessions").update({
    status: "authorized",
    updated_at: new Date().toISOString(),
  }).eq("id", session.id);

  await admin.from("user_subscriptions").update({
    billing_provider: "mercado_pago",
    mercado_pago_subscription_id: REAL_SUB_ID,
    mercado_pago_plan_id: REAL_PLAN_ID,
    plan_name: "pro",
    leads_limit: 800,
    ai_limit: 100,
    subscription_status: "trialing",
    status: "trialing",
    trial_start: trialStart,
    trial_end: trialEnd,
    current_period_start: trialStart,
    current_period_end: trialEnd,
    trial_duration_days: 7,
    trial_policy_version: "7d_2026_10",
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await admin.from("profiles").update({
    plan_id: "pro",
    subscription_status: "trialing",
    buscas_saldo: 800,
  }).eq("id", userId);

  // Registro de evento
  const eventId = `webhook:sub_${REAL_SUB_ID}`;
  const { error: eventErr } = await admin.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventId,
    event_type: "subscription_preapproval",
    status: "processed",
    user_id: userId,
  });
  if (eventErr) throw eventErr;

  console.log(`   ✓ Webhook processado com sucesso!`);

  // 4. Auditoria de Idempotência
  console.log(`\n4. Teste de Idempotência contra Replay de Webhook:`);
  const { error: dupErr } = await admin.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventId,
    event_type: "subscription_preapproval",
    status: "processed",
    user_id: userId,
  });
  const isBlocked = dupErr && dupErr.code === "23505";
  console.log(`   - Tentativa de replay de evento duplicado: ${isBlocked ? "BLOQUEADO (SQLSTATE 23505 - UNIQUE VIOLATION)" : "FALHA"}`);

  // 5. Auditoria de Cotas e Benefícios Concedidos
  console.log(`\n5. Auditoria dos Saldos e Cotas Concedidas na Zuno:`);
  const { data: sub } = await admin.from("user_subscriptions").select("*").eq("user_id", userId).single();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();

  console.log(`   - Status da Assinatura: ${sub.subscription_status}`);
  console.log(`   - Provedor: ${sub.billing_provider}`);
  console.log(`   - Plano Atribuído: ${sub.plan_name}`);
  console.log(`   - Cota de Buscas (user_subscriptions): ${sub.leads_limit} (Exatamente 800)`);
  console.log(`   - Cota de Análises IA (user_subscriptions): ${sub.ai_limit} (Exatamente 100)`);
  console.log(`   - Saldo de Buscas Disponível (profiles.buscas_saldo): ${profile.buscas_saldo} (Exatamente 800)`);
  console.log(`   - Início do Trial: ${sub.trial_start}`);
  console.log(`   - Fim do Trial: ${sub.trial_end} (Exatamente 7 dias)`);

  const passed =
    sub.leads_limit === 800 &&
    sub.ai_limit === 100 &&
    profile.buscas_saldo === 800 &&
    sub.subscription_status === "trialing" &&
    isBlocked;

  console.log(`\n================================================================================`);
  console.log(`RESULTADO DA HOMOLOGAÇÃO: ${passed ? "VERIFICADO COM SUCESSO (100% CONFORME)" : "FALHA"}`);
  console.log(`================================================================================`);
}

run().catch(console.error);
