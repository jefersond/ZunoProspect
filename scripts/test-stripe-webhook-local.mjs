import crypto from "node:crypto";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:55321";
const WEBHOOK_SECRET = "whsec_test_mock_rc1_secret_12345";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function main() {
  console.log("=== INICIANDO HOMOLOGAÇÃO STRIPE TEST MODE LOCAL ===");

  const adminClient = createClient(LOCAL_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Cria usuário de teste via auth
  const ts = Date.now();
  const testEmail = `stripe.test.${ts}@local.test`;
  console.log(`1. Criando usuário de teste: ${testEmail}`);

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: "TestPassword!2026",
    email_confirm: true,
  });

  if (authError || !authData.user?.id) {
    throw new Error(`Falha ao criar usuário de teste: ${JSON.stringify(authError)}`);
  }

  const userId = authData.user.id;
  console.log(`   Usuário criado com ID: ${userId}`);

  // Verifica perfil inicial no Postgres
  const { data: initialProfile } = await adminClient
    .from("profiles")
    .select("buscas_saldo, plan_id, subscription_status")
    .eq("id", userId)
    .single();
  console.log("   Perfil inicial no Postgres:", initialProfile);

  // 2. Prepara evento Stripe checkout.session.completed (Trial de 7 dias, Plano Pro)
  const stripeEventId = `evt_test_${ts}`;
  const checkoutSessionId = `cs_test_${ts}`;
  const subscriptionId = `sub_test_${ts}`;
  const customerId = `cus_test_${ts}`;

  const eventPayload = {
    id: stripeEventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: checkoutSessionId,
        object: "checkout.session",
        amount_total: 9700,
        currency: "brl",
        customer: customerId,
        customer_details: {
          email: testEmail,
          name: "Assinante Teste Stripe",
        },
        metadata: {
          plan_id: "pro",
          user_id: userId,
          conversion_path: "trial",
          trial_duration_days: "7",
        },
        payment_status: "paid",
        status: "complete",
        subscription: subscriptionId,
      },
    },
  };

  const payloadString = JSON.stringify(eventPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payloadString}`;
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const stripeSignatureHeader = `t=${timestamp},v1=${signature}`;

  console.log(`2. Enviando Webhook Stripe assinado com ${WEBHOOK_SECRET.slice(0, 10)}...`);
  console.log(`   Event ID: ${stripeEventId}`);
  console.log(`   Header Stripe-Signature: ${stripeSignatureHeader.slice(0, 30)}...`);

  // Função auxiliar para enviar o webhook
  async function postWebhook() {
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

  // 3. Primeiro disparo do Webhook
  const res1 = await postWebhook();
  console.log(`3. Resposta 1ª chamada Webhook (HTTP ${res1.status}):`, res1.body);

  // 4. Verificação no banco de dados local
  const { data: subRow } = await adminClient
    .from("user_subscriptions")
    .select("plan_name, subscription_status, leads_limit, ai_limit, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("4. user_subscriptions após webhook:", subRow);

  const { data: profRow } = await adminClient
    .from("profiles")
    .select("buscas_saldo, plan_id, subscription_status, stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .single();
  console.log("   profiles após webhook:", profRow);

  const { data: paymentEvents } = await adminClient
    .from("payment_events")
    .select("id, provider, provider_event_id, event_type, plan_name, status")
    .eq("provider_event_id", stripeEventId);
  console.log("   payment_events registrado:", paymentEvents);

  const saldoAposPrimeiro = profRow?.buscas_saldo;

  // 5. TESTE DE REPETIÇÃO / RETRY / CONCORRÊNCIA DO MESMO EVENTO STRIPE
  console.log("5. Enviando SEGUNDO disparo do MESMO evento Stripe (simulação de retry por timeout de rede)...");
  const res2 = await postWebhook();
  console.log(`   Resposta 2ª chamada Webhook (HTTP ${res2.status}):`, res2.body);

  // 6. Verificação de IDEMPOTÊNCIA: o saldo duplicou?
  const { data: profRow2 } = await adminClient
    .from("profiles")
    .select("buscas_saldo, plan_id, subscription_status")
    .eq("id", userId)
    .single();
  console.log("6. profiles após 2º webhook:", profRow2);

  const saldoAposSegundo = profRow2?.buscas_saldo;

  if (saldoAposSegundo === saldoAposPrimeiro) {
    console.log(`✅ IDEMPOTÊNCIA CONFIRMADA: Saldo inicial pós-webhook = ${saldoAposPrimeiro}, saldo pós-retry = ${saldoAposSegundo} (NENHUM CRÉDITO DUPLICADO)`);
  } else {
    console.error(`❌ FALHA DE IDEMPOTÊNCIA: Saldo duplicou de ${saldoAposPrimeiro} para ${saldoAposSegundo}!`);
    process.exit(1);
  }

  // 7. Verificação de eventos duplicados em payment_events
  const { count: eventCount } = await adminClient
    .from("payment_events")
    .select("*", { count: "exact", head: true })
    .eq("provider_event_id", stripeEventId);
  console.log(`   Quantidade de registros em payment_events para o evento: ${eventCount}`);
  if (eventCount === 1) {
    console.log("✅ payment_events manteve exatamente 1 registro (constraint UNIQUE respeitada)");
  } else {
    console.error("❌ payment_events permitiu duplicação de registro!");
    process.exit(1);
  }

  console.log("\n=== TESTE 2 STRIPE CONCLUÍDO COM 100% DE SUCESSO ===");
}

main().catch((err) => {
  console.error("Erro fatal no teste:", err);
  process.exit(1);
});
