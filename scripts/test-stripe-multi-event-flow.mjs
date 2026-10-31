import crypto from "node:crypto";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:55321";
const WEBHOOK_SECRET = "whsec_test_mock_rc1_secret_12345";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function postWebhook(payload) {
  const payloadString = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payloadString}`;
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const stripeSignatureHeader = `t=${timestamp},v1=${signature}`;

  return new Promise((resolve, reject) => {
    const u = new URL(`${LOCAL_URL}/functions/v1/stripe-webhook`);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": stripeSignatureHeader,
          "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.write(payloadString);
    req.end();
  });
}

async function main() {
  console.log("=== INICIANDO TESTE 2: CICLO MULTI-EVENTO STRIPE (TEST MODE) ===");

  const adminClient = createClient(LOCAL_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const testEmail = `stripe.multievent.${ts}@local.test`;
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: "TestPassword!2026",
    email_confirm: true,
  });

  if (authError || !authData.user?.id) {
    throw new Error(`Falha ao criar usuário de teste: ${JSON.stringify(authError)}`);
  }

  const userId = authData.user.id;
  console.log(`1. Usuário criado: ${testEmail} (${userId})`);

  const customerId = `cus_test_${ts}`;
  const subscriptionId = `sub_test_${ts}`;
  const evtCheckoutId = `evt_checkout_${ts}`;
  const evtSubUpdatedId = `evt_sub_updated_${ts}`;

  // EVENTO 1: checkout.session.completed (Trial 7 dias Pro)
  console.log("\n2. Disparando Evento 1: checkout.session.completed");
  const payloadCheckout = {
    id: evtCheckoutId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${ts}`,
        object: "checkout.session",
        amount_total: 9700,
        currency: "brl",
        customer: customerId,
        customer_details: { email: testEmail, name: "Assinante Teste Multi-Evento" },
        metadata: { plan_id: "pro", user_id: userId, conversion_path: "trial", trial_duration_days: "7" },
        payment_status: "paid",
        status: "complete",
        subscription: subscriptionId,
      },
    },
  };

  const res1 = await postWebhook(payloadCheckout);
  console.log(`   Resposta Evento 1 (HTTP ${res1.status}):`, res1.body);

  const { data: subAfterEvt1 } = await adminClient
    .from("user_subscriptions")
    .select("plan_name, subscription_status, leads_limit, ai_limit")
    .eq("user_id", userId)
    .single();
  console.log("   user_subscriptions após Evento 1:", subAfterEvt1);

  // EVENTO 2: customer.subscription.updated (mesma assinatura, confirmação de ativação regular)
  console.log("\n3. Disparando Evento 2: customer.subscription.updated (mesma assinatura)");
  const payloadSubUpdated = {
    id: evtSubUpdatedId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000) + 5,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        metadata: { plan_id: "pro", user_id: userId, billing_cycle: "monthly" },
        items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
      },
    },
  };

  const res2 = await postWebhook(payloadSubUpdated);
  console.log(`   Resposta Evento 2 (HTTP ${res2.status}):`, res2.body);

  const { data: subAfterEvt2 } = await adminClient
    .from("user_subscriptions")
    .select("plan_name, subscription_status, leads_limit, ai_limit")
    .eq("user_id", userId)
    .single();
  console.log("   user_subscriptions após Evento 2:", subAfterEvt2);

  // EVENTO 3 & 4: RETRIES (Replay do Evento 1 e do Evento 2)
  console.log("\n4. Testando RETRIES / REPLAY de ambos os eventos...");
  const resReplay1 = await postWebhook(payloadCheckout);
  console.log(`   Replay Evento 1 (HTTP ${resReplay1.status}):`, resReplay1.body);

  const resReplay2 = await postWebhook(payloadSubUpdated);
  console.log(`   Replay Evento 2 (HTTP ${resReplay2.status}):`, resReplay2.body);

  const { data: subFinal } = await adminClient
    .from("user_subscriptions")
    .select("plan_name, subscription_status, leads_limit, ai_limit")
    .eq("user_id", userId)
    .single();
  console.log("\n5. user_subscriptions FINAL após todo o ciclo:", subFinal);

  // Verificação de cotas: NUNCA devem duplicar
  if (subFinal.leads_limit === 800 && subFinal.ai_limit === 100) {
    console.log("✅ Limites de créditos PERFEITOS: 800 buscas e 100 análises IA (ZERO MULTIPLICAÇÃO)");
  } else {
    console.error(`❌ ERRO: Limites multiplicados indevidamente: leads=${subFinal.leads_limit}, ai=${subFinal.ai_limit}`);
    process.exit(1);
  }

  // Verificação de registros em payment_events: exatamente 2 eventos registrados (1 para evtCheckout, 1 para evtSubUpdated)
  const { data: evts } = await adminClient
    .from("payment_events")
    .select("provider_event_id, event_type")
    .eq("user_id", userId);
  console.log("6. Registros em payment_events:", evts);

  if (evts.length === 2) {
    console.log("✅ payment_events manteve exatamente 2 registros distintos; nenhuma repetição foi gravada.");
  } else {
    console.error(`❌ ERRO: Quantidade inesperada em payment_events: ${evts.length}`);
    process.exit(1);
  }

  console.log("\n=== TESTE 2 CONCLUÍDO COM 100% DE SUCESSO ===");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
