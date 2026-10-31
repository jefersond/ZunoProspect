import fs from "node:fs";
import https from "node:https";
import path from "node:path";

function loadEnvFromDisk() {
  const candidatePaths = [
    path.resolve("supabase/functions/.env"),
    path.resolve("ZunoProspect-prompt-v6/supabase/functions/.env"),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
          }
        }
        return envPath;
      }
    } catch {}
  }
  return "";
}

loadEnvFromDisk();

function resolveTestToken() {
  if (process.env.MERCADO_PAGO_TEST_TOKEN) return process.env.MERCADO_PAGO_TEST_TOKEN.trim();
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST) return process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST.trim();
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN) return process.env.MERCADO_PAGO_ACCESS_TOKEN.trim();
  return "";
}

const testToken = resolveTestToken();

const isExplicitTestMode =
  process.env.MP_ENVIRONMENT === "test" ||
  process.env.MERCADO_PAGO_ENVIRONMENT === "test" ||
  Boolean(process.env.MERCADO_PAGO_TEST_TOKEN) ||
  Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST) ||
  testToken.startsWith("TEST-");

if (!testToken || testToken === "COLE_SUA_CHAVE_AQUI") {
  console.log(JSON.stringify({
    ok: false,
    error: "MERCADO_PAGO_TEST_TOKEN_MISSING",
    message: "Nenhuma credencial de teste configurada.",
    bloqueio: "Aguardando inclusão de MERCADO_PAGO_TEST_TOKEN no arquivo supabase/functions/.env (sem expor no chat)."
  }, null, 2));
  process.exit(0);
}

// Validação de Ambiente de Teste conforme regras do Mercado Pago:
// Credenciais de teste de aplicações modernas podem iniciar com APP_USR-.
// Validamos que a credencial foi designada para ambiente de Teste e impedimos o uso em live.
if (!isExplicitTestMode && process.env.ALLOW_LIVE_CALLS !== "true") {
  console.error("ERRO DE SEGURANÇA: Credencial informada sem identificação explícita de ambiente de TESTE.");
  console.error("Para executar contra a API de Teste com credenciais de aplicação (ex: APP_USR-...), defina MP_ENVIRONMENT=test ou use MERCADO_PAGO_TEST_TOKEN.");
  process.exit(1);
}

function mpRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = https.request(
      {
        hostname: "api.mercadopago.com",
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let respData = "";
        res.on("data", (chunk) => (respData += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(respData);
          } catch {
            parsed = respData;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function maskId(id) {
  if (!id || typeof id !== "string") return id;
  if (id.length <= 8) return id.slice(0, 2) + "***" + id.slice(-2);
  return id.slice(0, 4) + "..." + id.slice(-4);
}

async function main() {
  console.log("=== INICIANDO CRIAÇÃO REAL DE PLANO NA API DE TESTE DO MERCADO PAGO ===");

  const planPayload = {
    reason: "ZUNO PROSPECT - Pro",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 97.0,
      currency_id: "BRL",
      free_trial: {
        frequency: 7,
        frequency_type: "days",
      },
    },
    payment_methods_allowed: {
      payment_types: [{ id: "credit_card" }],
    },
    back_url: "https://www.zunoprospect.com.br/prospeccao?subscription=success&provider=mercado_pago",
  };

  const planRes = await mpRequest("/preapproval_plan", "POST", planPayload);
  console.log(`1. HTTP Status: ${planRes.status}`);

  if (planRes.status >= 400) {
    console.error("Falha ao criar plano na API de teste:", planRes.data);
    process.exit(1);
  }

  const planData = planRes.data;
  console.log("2. Detalhes do Plano Criado:");
  console.log(`   - ID Mascarado: ${maskId(planData.id)}`);
  console.log(`   - Valor: R$ ${planData.auto_recurring?.transaction_amount}`);
  console.log(`   - Moeda: ${planData.auto_recurring?.currency_id}`);
  console.log(`   - Periodicidade: ${planData.auto_recurring?.frequency} ${planData.auto_recurring?.frequency_type}`);
  console.log(`   - Período Gratuito: ${planData.auto_recurring?.free_trial?.frequency} ${planData.auto_recurring?.free_trial?.frequency_type}`);
  console.log(`   - Status: ${planData.status}`);
  console.log(`   - Link init_point: ${planData.init_point}`);

  // Testar associação de comprador de teste
  const testBuyerEmail = `test_user_${Date.now()}@testuser.com`;
  const subPayload = {
    preapproval_plan_id: planData.id,
    reason: "ZUNO PROSPECT - Pro",
    payer_email: testBuyerEmail,
    external_reference: "homologacao_rc1_user_test",
    back_url: "https://www.zunoprospect.com.br/prospeccao?subscription=success&provider=mercado_pago",
    status: "pending",
  };

  const subRes = await mpRequest("/preapproval", "POST", subPayload);
  console.log(`\n3. Associação de Comprador de Teste (${testBuyerEmail}):`);
  console.log(`   - HTTP Status: ${subRes.status}`);
  if (subRes.status < 400 && subRes.data?.id) {
    console.log(`   - Assinatura ID Mascarada: ${maskId(subRes.data.id)}`);
    console.log(`   - Checkout URL (init_point): ${subRes.data.init_point}`);
    console.log(`   - Status da Assinatura: ${subRes.data.status}`);
  } else {
    console.log("   - Resposta:", subRes.data);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
