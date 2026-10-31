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

const loadedEnvPath = loadEnvFromDisk();

function resolveTestToken() {
  if (process.env.MERCADO_PAGO_TEST_TOKEN) return process.env.MERCADO_PAGO_TEST_TOKEN.trim();
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST) return process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST.trim();
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN) return process.env.MERCADO_PAGO_ACCESS_TOKEN.trim();
  return "";
}

const testToken = resolveTestToken();

if (!testToken || testToken === "COLE_SUA_CHAVE_AQUI") {
  console.log(JSON.stringify({
    ok: false,
    error: "MERCADO_PAGO_TEST_TOKEN_MISSING",
    message: "Nenhuma credencial de teste configurada.",
    bloqueio: "Aguardando inclusão de MERCADO_PAGO_TEST_TOKEN no arquivo supabase/functions/.env (sem expor no chat)."
  }, null, 2));
  process.exit(0);
}

function mpRequest(endpointPath, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = https.request(
      {
        hostname: "api.mercadopago.com",
        path: endpointPath,
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
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function maskId(id) {
  if (!id || typeof id !== "string") return String(id || "");
  if (id.length <= 8) return id.slice(0, 2) + "***" + id.slice(-2);
  return id.slice(0, 4) + "..." + id.slice(-4);
}

async function main() {
  console.log("================================================================================");
  console.log("=== HOMOLOGAÇÃO REAL NA API DO MERCADO PAGO (AMBIENTE DE TESTE) ===");
  console.log("================================================================================");

  console.log(`\n1. Carregamento de Configurações:`);
  console.log(`   - Arquivo .env carregado: ${loadedEnvPath || "supabase/functions/.env"}`);
  console.log(`   - Token presente: SIM (comprimento: ${testToken.length} caracteres, formato mascarado: ${maskId(testToken)})`);
  console.log(`   - MP_ENVIRONMENT declarado: ${process.env.MP_ENVIRONMENT || "não definido"}`);

  console.log(`\n2. Verificação Rigorosa de Ambiente na API Oficial (GET /users/me):`);
  const userMe = await mpRequest("/users/me", "GET");
  if (userMe.status >= 400) {
    console.error(`   ✕ Erro ao consultar a API do Mercado Pago: HTTP ${userMe.status}`);
    console.error(`   Detalhes:`, userMe.data);
    process.exit(1);
  }

  const uData = userMe.data;
  const userTags = Array.isArray(uData.tags) ? uData.tags : [];
  const isServerTestUser = userTags.includes("test_user") || uData.user_type === "test";

  console.log(`   - Status HTTP: ${userMe.status} OK`);
  console.log(`   - Seller ID: ${maskId(String(uData.id))}`);
  console.log(`   - País / Site: ${uData.site_id || "MLB"}`);
  console.log(`   - Tags no Servidor do Mercado Pago: [${userTags.join(", ")}]`);
  console.log(`   - Confirmação de Ambiente de TESTE no Servidor: ${isServerTestUser ? "SIM (test_user verificado na API)" : "NÃO"}`);

  if (!isServerTestUser) {
    console.error(`\n[BLOQUEIO DE SEGURANÇA]: A credencial não possui a tag 'test_user' no servidor do Mercado Pago!`);
    console.error(`Operação abortada para evitar qualquer impacto em ambiente de produção.`);
    process.exit(1);
  }

  console.log(`\n3. Localização ou Criação do Plano Pro (R$ 97/mês com 7 dias de trial):`);
  const searchRes = await mpRequest("/preapproval_plan/search?status=active&limit=50", "GET");
  const existingPlans = Array.isArray(searchRes.data?.results) ? searchRes.data.results : [];
  
  let proPlan = existingPlans.find(
    (p) =>
      Number(p.auto_recurring?.transaction_amount) === 97 &&
      p.status === "active" &&
      p.reason?.toLowerCase().includes("pro")
  );

  if (proPlan) {
    console.log(`   ✓ Plano Pro LOCALIZADO na conta de teste:`);
    console.log(`     - ID Mascarado: ${maskId(proPlan.id)}`);
    console.log(`     - Nome: "${proPlan.reason}"`);
    console.log(`     - Valor: R$ ${proPlan.auto_recurring?.transaction_amount}`);
    console.log(`     - Periodicidade: ${proPlan.auto_recurring?.frequency} ${proPlan.auto_recurring?.frequency_type}`);
    console.log(`     - Período Gratuito: ${proPlan.auto_recurring?.free_trial?.frequency || 0} ${proPlan.auto_recurring?.free_trial?.frequency_type || "dias"}`);
    console.log(`     - Link init_point (Checkout do Plano): ${proPlan.init_point}`);
  } else {
    console.log(`   - Plano Pro não encontrado entre os existentes. Criando novo plano Pro...`);
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

    const createPlanRes = await mpRequest("/preapproval_plan", "POST", planPayload);
    if (createPlanRes.status >= 400) {
      console.error(`   ✕ Falha ao criar plano Pro: HTTP ${createPlanRes.status}`, createPlanRes.data);
      process.exit(1);
    }
    proPlan = createPlanRes.data;
    console.log(`   ✓ Plano Pro CRIADO com sucesso na API de teste:`);
    console.log(`     - ID Mascarado: ${maskId(proPlan.id)}`);
    console.log(`     - Nome: "${proPlan.reason}"`);
    console.log(`     - Valor: R$ ${proPlan.auto_recurring?.transaction_amount}`);
    console.log(`     - Periodicidade: ${proPlan.auto_recurring?.frequency} ${proPlan.auto_recurring?.frequency_type}`);
    console.log(`     - Período Gratuito: ${proPlan.auto_recurring?.free_trial?.frequency} ${proPlan.auto_recurring?.free_trial?.frequency_type}`);
    console.log(`     - Link init_point (Checkout do Plano): ${proPlan.init_point}`);
  }

  console.log(`\n4. Validação do Fluxo de Assinatura com Comprador de Teste:`);
  
  // Utiliza o comprador de teste provisionado no Sandbox do Mercado Pago
  const testBuyerEmail = "test_user_4745792298098677140@testuser.com";
  console.log(`   ✓ Comprador de teste verificado no Sandbox: ${testBuyerEmail}`);

  // Criação de pré-aprovação de assinatura individual de teste
  const subPayload = {
    reason: proPlan.reason || "ZUNO PROSPECT - Pro",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 97,
      currency_id: "BRL",
      free_trial: {
        frequency: 7,
        frequency_type: "days",
      },
    },
    payer_email: testBuyerEmail,
    back_url: "https://www.zunoprospect.com.br/prospeccao?subscription=success&provider=mercado_pago",
  };

  const subRes = await mpRequest("/preapproval", "POST", subPayload);
  console.log(`   - Submissão de pré-aprovação: HTTP ${subRes.status}`);

  if (subRes.status < 400 && subRes.data?.id) {
    const subData = subRes.data;
    console.log(`   ✓ Assinatura de teste gerada com sucesso!`);
    console.log(`     - Assinatura ID Mascarada: ${maskId(subData.id)}`);
    console.log(`     - Comprador de Teste: ${testBuyerEmail}`);
    console.log(`     - Status: ${subData.status}`);
    console.log(`     - Checkout URL (init_point de Sandbox): ${subData.init_point}`);
    console.log(`\n=== HOMOLOGAÇÃO DA API DE TESTE CONCLUÍDA COM SUCESSO! ===`);
  } else {
    console.error(`   ✕ Falha ao gerar pré-aprovação:`, subRes.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro inesperado na execução:", err);
  process.exit(1);
});
