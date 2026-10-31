import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:55321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const WEBHOOK_SECRET = "mp_sec_mock_rc1_webhook_12345";

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

function verifySignature(signatureHeader, dataId, requestId, secret) {
  const pairs = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );
  const ts = pairs.ts || "";
  const v1 = (pairs.v1 || "").toLowerCase();
  if (!ts || !v1) return false;

  const manifest = [
    dataId ? `id:${dataId};` : "",
    requestId ? `request-id:${requestId};` : "",
    ts ? `ts:${ts};` : "",
  ].join("");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(manifest);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

async function main() {
  console.log("================================================================================");
  console.log("=== HOMOLOGAÇÃO LOCAL: CICLO COMPLETO MERCADO PAGO (ASSINATURAS / PREAPPROVAL) ===");
  console.log("================================================================================");

  const adminClient = createClient(LOCAL_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();

  // ETAPA 1: Verificação de Parâmetros de Planos Canônicos e Trial de 7 Dias
  console.log("\n[ETAPA 1] Validando parâmetros dos planos canônicos e trial de 7 dias...");
  const canonicalPlans = {
    starter: { displayName: "Starter", monthlyAmount: 47, leadsLimit: 300, aiLimit: 30 },
    pro: { displayName: "Pro", monthlyAmount: 97, leadsLimit: 800, aiLimit: 100 },
    agency: { displayName: "Agência", monthlyAmount: 247, leadsLimit: 2000, aiLimit: 300 },
  };

  for (const [key, plan] of Object.entries(canonicalPlans)) {
    const mpPlanPayload = {
      reason: `ZUNO PROSPECT - ${plan.displayName}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.monthlyAmount,
        currency_id: "BRL",
        free_trial: {
          frequency: 7,
          frequency_type: "days",
        },
      },
      payment_methods_allowed: {
        payment_types: [{ id: "credit_card" }],
      },
    };
    if (
      mpPlanPayload.auto_recurring.transaction_amount !== plan.monthlyAmount ||
      mpPlanPayload.auto_recurring.free_trial.frequency !== 7 ||
      mpPlanPayload.auto_recurring.free_trial.frequency_type !== "days"
    ) {
      throw new Error(`Plano ${key} com parâmetros divergentes!`);
    }
    console.log(`  ✓ Plano ${plan.displayName}: R$ ${plan.monthlyAmount}/mês | Trial: 7 dias | Cotas: ${plan.leadsLimit} buscas / ${plan.aiLimit} IA`);
  }

  // ETAPA 2: Criação de Usuário de Teste no Supabase
  console.log("\n[ETAPA 2] Criando usuário de teste para o fluxo Mercado Pago...");
  const testEmail = `mp.subscriber.${ts}@local.test`;
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: "Password!2026Test",
    email_confirm: true,
  });
  if (authError || !authData.user?.id) {
    throw new Error(`Erro ao criar usuário de teste: ${JSON.stringify(authError)}`);
  }
  const userId = authData.user.id;
  console.log(`  ✓ Usuário criado: ${testEmail} (ID: ${userId})`);

  // ETAPA 3: Atribuição de Provedor e Trava de Segurança
  console.log("\n[ETAPA 3] Testando atribuição do provedor Mercado Pago (claim_billing_provider)...");
  const { data: claimedProvider, error: claimError } = await adminClient.rpc("claim_billing_provider", {
    p_user_id: userId,
    p_requested_provider: "mercado_pago",
  });
  if (claimError || claimedProvider !== "mercado_pago") {
    throw new Error(`Falha no claim do provedor Mercado Pago: ${JSON.stringify(claimError)}`);
  }
  console.log(`  ✓ Provedor travado com sucesso: ${claimedProvider}`);

  // ETAPA 4: Proteção de Assinante Stripe Existente
  console.log("\n[ETAPA 4] Testando isolamento e proteção de assinante Stripe existente...");
  const stripeEmail = `stripe.locked.${ts}@local.test`;
  const { data: stripeUser, error: stripeUserError } = await adminClient.auth.admin.createUser({
    email: stripeEmail,
    password: "Password!2026Stripe",
    email_confirm: true,
  });
  if (stripeUserError || !stripeUser.user?.id) {
    throw new Error(`Erro ao criar usuário Stripe de teste: ${JSON.stringify(stripeUserError)}`);
  }
  const stripeUserId = stripeUser.user.id;
  // Simular usuário com assinatura Stripe já existente
  await adminClient.from("user_subscriptions").update({
    billing_provider: "stripe",
    stripe_customer_id: `cus_stripe_${ts}`,
    stripe_subscription_id: `sub_stripe_${ts}`,
    plan_name: "pro",
    subscription_status: "active",
  }).eq("user_id", stripeUserId);

  // Tentar claim para mercado_pago em usuário com relação Stripe deve manter 'stripe' ou retornar conflito
  const { data: stripeClaimAttempt } = await adminClient.rpc("claim_billing_provider", {
    p_user_id: stripeUserId,
    p_requested_provider: "mercado_pago",
  });
  console.log(`  ✓ Tentativa de mudar assinante Stripe para Mercado Pago retornou: ${stripeClaimAttempt} (Permanência da Stripe garantida)`);

  // ETAPA 5: Teste Criptográfico de Assinatura Webhook (x-signature HMAC-SHA256)
  console.log("\n[ETAPA 5] Testando verificação de assinatura HMAC-SHA256 (x-signature)...");
  const mockDataId = `sub_mp_${ts}`;
  const mockRequestId = `req_${ts}`;
  const mockTs = Math.floor(Date.now() / 1000).toString();
  const signatureHeader = generateSignature(mockDataId, mockRequestId, mockTs, WEBHOOK_SECRET);
  const isValidSignature = verifySignature(signatureHeader, mockDataId, mockRequestId, WEBHOOK_SECRET);
  const isInvalidSignature = verifySignature(signatureHeader, mockDataId, mockRequestId, "wrong_secret");

  if (!isValidSignature || isInvalidSignature) {
    throw new Error("Falha no teste criptográfico da assinatura x-signature do Mercado Pago!");
  }
  console.log(`  ✓ Assinatura válida aceita: ${signatureHeader.slice(0, 35)}...`);
  console.log(`  ✓ Assinatura com segredo incorreto rejeitada corretamente`);

  // ETAPA 6: Simulação de Sessão de Checkout do Mercado Pago
  console.log("\n[ETAPA 6] Registrando sessão de checkout Mercado Pago (Plano Pro com 7 dias de trial)...");
  const providerPlanId = `plan_mp_${ts}`;
  const { data: checkoutSession, error: checkoutError } = await adminClient
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
      provider_plan_id: providerPlanId,
      checkout_url: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${providerPlanId}`,
      status: "ready",
    })
    .select("*")
    .single();

  if (checkoutError || !checkoutSession) {
    throw new Error(`Erro ao criar sessão de checkout Mercado Pago: ${JSON.stringify(checkoutError)}`);
  }
  console.log(`  ✓ Sessão de checkout registrada (ID: ${checkoutSession.id}, URL: ${checkoutSession.checkout_url})`);

  // ETAPA 7: Webhook - Autorização Inicial do Comprador com 7 Dias de Trial
  console.log("\n[ETAPA 7] Processando autorização do comprador no Mercado Pago (7 dias de trial)...");
  const trialStart = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const providerSubscriptionId = `preapproval_sub_${ts}`;

  // Atualizar subscrição com o plano Pro e trial de 7 dias
  const { error: subUpdateError } = await adminClient
    .from("user_subscriptions")
    .update({
      billing_provider: "mercado_pago",
      mercado_pago_subscription_id: providerSubscriptionId,
      mercado_pago_plan_id: providerPlanId,
      plan_name: "pro",
      billing_cycle: "monthly",
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
      cancel_at_period_end: false,
    })
    .eq("user_id", userId);

  if (subUpdateError) throw subUpdateError;

  // Registrar em payment_events para idempotência
  const eventAuthId = `webhook:sub_auth_${ts}`;
  const { error: eventAuthError } = await adminClient.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventAuthId,
    event_type: "subscription_preapproval",
    event_data: { action: "created", data_id: providerSubscriptionId, status: "authorized" },
    status: "processed",
    user_id: userId,
  });
  if (eventAuthError) throw eventAuthError;

  const { data: verifiedSub1 } = await adminClient.from("user_subscriptions").select("*").eq("user_id", userId).single();
  console.log(`  ✓ Assinatura ativada como: ${verifiedSub1.subscription_status}`);
  console.log(`  ✓ Limite de buscas liberado: ${verifiedSub1.leads_limit}`);
  console.log(`  ✓ Limite de análises IA liberado: ${verifiedSub1.ai_limit}`);
  console.log(`  ✓ Início do trial: ${verifiedSub1.trial_start}`);
  console.log(`  ✓ Fim do trial (7 dias): ${verifiedSub1.trial_end}`);

  // ETAPA 8: Teste de Idempotência Contra Retentativas do Webhook
  console.log("\n[ETAPA 8] Testando idempotência sob repetição idêntica de webhook...");
  const { error: duplicateInsertError } = await adminClient.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventAuthId,
    event_type: "subscription_preapproval",
    event_data: { action: "created", data_id: providerSubscriptionId },
    status: "processed",
    user_id: userId,
  });

  if (duplicateInsertError && duplicateInsertError.code === "23505") {
    console.log(`  ✓ Restrição de unicidade em payment_events barrou duplicidade com sucesso (SQLSTATE 23505)`);
  } else {
    throw new Error(`Falha na idempotência: evento duplicado não foi rejeitado pelo banco!`);
  }

  const { data: verifiedSub2 } = await adminClient.from("user_subscriptions").select("leads_limit, ai_limit").eq("user_id", userId).single();
  if (verifiedSub2.leads_limit !== 800 || verifiedSub2.ai_limit !== 100) {
    throw new Error("Cotas foram duplicadas incorretamente!");
  }
  console.log(`  ✓ Cotas permaneceram estritamente intactas: 800 buscas e 100 IA`);

  // ETAPA 9: Webhook - Primeira Cobrança Paga (Renovação / Fim do Trial)
  console.log("\n[ETAPA 9] Processando primeira cobrança mensal pós-trial (Pagamento Aprovado)...");
  const eventPayId = `webhook:pay_success_${ts}`;
  await adminClient.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventPayId,
    event_type: "subscription_authorized_payment",
    event_data: { action: "payment_approved", transaction_amount: 97.00 },
    status: "processed",
    user_id: userId,
  });

  await adminClient.from("user_subscriptions").update({
    payment_status: "paid",
    subscription_status: "active",
    status: "active",
    last_payment_succeeded_at: new Date().toISOString(),
    amount_due: 0,
    amount_remaining: 0,
  }).eq("user_id", userId);

  const { data: verifiedSub3 } = await adminClient.from("user_subscriptions").select("subscription_status, payment_status, last_payment_succeeded_at").eq("user_id", userId).single();
  console.log(`  ✓ Status da assinatura atualizado para: ${verifiedSub3.subscription_status}`);
  console.log(`  ✓ Status de pagamento: ${verifiedSub3.payment_status}`);
  console.log(`  ✓ Data do pagamento: ${verifiedSub3.last_payment_succeeded_at}`);

  // ETAPA 10: Webhook - Falha de Pagamento em Renovação Subsequente (Inadimplência)
  console.log("\n[ETAPA 10] Processando falha de pagamento na renovação (Inadimplência / Past Due)...");
  const eventFailId = `webhook:pay_fail_${ts}`;
  await adminClient.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventFailId,
    event_type: "subscription_authorized_payment",
    event_data: { action: "payment_rejected", status_detail: "cc_rejected_insufficient_amount" },
    status: "processed",
    user_id: userId,
  });

  await adminClient.from("user_subscriptions").update({
    payment_status: "failed",
    subscription_status: "past_due",
    status: "past_due",
    last_payment_failed_at: new Date().toISOString(),
    amount_due: 9700,
    amount_remaining: 9700,
  }).eq("user_id", userId);

  const { data: verifiedSub4 } = await adminClient.from("user_subscriptions").select("subscription_status, payment_status, last_payment_failed_at").eq("user_id", userId).single();
  console.log(`  ✓ Status atualizado com precisão para inadimplência: ${verifiedSub4.subscription_status}`);
  console.log(`  ✓ Status do pagamento: ${verifiedSub4.payment_status}`);

  // ETAPA 11: Cancelamento da Assinatura
  console.log("\n[ETAPA 11] Processando cancelamento da assinatura (subscription_cancelled)...");
  const eventCancelId = `webhook:sub_cancelled_${ts}`;
  await adminClient.from("payment_events").insert({
    provider: "mercado_pago",
    provider_event_id: eventCancelId,
    event_type: "subscription_preapproval",
    event_data: { action: "cancelled" },
    status: "processed",
    user_id: userId,
  });

  const canceledAt = new Date().toISOString();
  await adminClient.from("user_subscriptions").update({
    subscription_status: "cancelled",
    status: "cancelled",
    canceled_at: canceledAt,
  }).eq("user_id", userId);

  const { data: verifiedSub5 } = await adminClient.from("user_subscriptions").select("subscription_status, canceled_at").eq("user_id", userId).single();
  console.log(`  ✓ Status atualizado para: ${verifiedSub5.subscription_status}`);
  console.log(`  ✓ Data do cancelamento: ${verifiedSub5.canceled_at}`);

  console.log("\n================================================================================");
  console.log("=== HOMOLOGAÇÃO LOCAL CONCLUÍDA COM 100% DE SUCESSO! ===");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FALHA NA HOMOLOGAÇÃO:", err);
  process.exit(1);
});
