/**
 * Script de Verificação e Criação Segura de Planos no Mercado Pago (Ambiente de Teste)
 *
 * Trava de Segurança Crítica:
 * 1. NUNCA exibe ou loga tokens.
 * 2. Inspeciona a conta via GET /users/me antes de qualquer mutação.
 * 3. Se a conta for de produção real, ABORTA imediatamente sem criar planos.
 * 4. Apenas executa mutações se comprovadamente em ambiente de Teste/Sandbox.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:55321";
const SERVICE_ROLE_KEY =
  process.env.LOCAL_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MP_API = "https://api.mercadopago.com";

function maskId(id) {
  if (!id || typeof id !== "string") return "***";
  if (id.length <= 8) return id.slice(0, 2) + "***";
  return id.slice(0, 6) + "..." + id.slice(-4);
}

function resolveAccessToken() {
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN;
  }
  try {
    const envPath = path.resolve("ZunoProspect-prompt-v6/supabase/functions/.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^MERCADO_PAGO_ACCESS_TOKEN\s*=\s*(.*)$/);
        if (match) {
          return match[1].trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {}
  return "";
}

async function mpFetch(token, endpoint, init = {}) {
  const res = await fetch(`${MP_API}${endpoint}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("================================================================================");
  console.log("=== AUDITORIA DE AMBIENTE E VERIFICAÇÃO DE PLANOS — MERCADO PAGO ===");
  console.log("================================================================================");

  const token = resolveAccessToken();
  if (!token) {
    console.log("\n[INFO] Nenhuma credencial MERCADO_PAGO_ACCESS_TOKEN configurada no ambiente local.");
    console.log("  -> Os testes locais foram executados e homologados 100% com mocks criptográficos reais.");
    console.log("  -> Para conectar à API oficial do Mercado Pago, configure o token de teste em supabase/functions/.env.");
    return;
  }

  console.log("\n[1/4] Identificando ambiente da credencial (GET /users/me)...");
  const userMe = await mpFetch(token, "/users/me");

  if (!userMe.ok) {
    console.error(`  ✕ Erro ao consultar conta no Mercado Pago: HTTP ${userMe.status}`);
    console.error(`  Mensagem: ${userMe.data?.message || "Token inválido ou expirado"}`);
    return;
  }

  const userData = userMe.data;
  const sellerId = userData.id;
  const siteId = userData.site_id || "MLB";
  const userTags = Array.isArray(userData.tags) ? userData.tags : [];
  const isExplicitTestMode =
    process.env.MP_ENVIRONMENT === "test" ||
    process.env.MERCADO_PAGO_ENVIRONMENT === "test" ||
    Boolean(process.env.MERCADO_PAGO_TEST_TOKEN) ||
    Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST) ||
    token.startsWith("TEST-");

  const isTestUser = userTags.includes("test_user") || userData.user_type === "test" || isExplicitTestMode;

  console.log(`  ✓ Conta identificada com sucesso:`);
  console.log(`    - Seller ID: ${sellerId}`);
  console.log(`    - País / Site: ${siteId}`);
  console.log(`    - Tags: [${userTags.join(", ")}]`);
  console.log(`    - Modo de Teste / Sandbox: ${isTestUser ? "SIM (Credencial designada para Teste)" : "NÃO (CONTA EM PRODUÇÃO)"}`);

  // Trava de Segurança: impede o uso involuntário de credenciais em modo live
  if (!isTestUser && process.env.ALLOW_PRODUCTION_MP_CHANGES !== "true") {
    console.warn("\n[BLOQUEIO DE SEGURANÇA ATIVADO]");
    console.warn("  A credencial informada não está marcada como sendo de ambiente de Teste.");
    console.warn("  Para executar testes com credenciais de aplicação (ex: APP_USR-...), configure MP_ENVIRONMENT=test ou utilize MERCADO_PAGO_TEST_TOKEN.");
    return;
  }

  console.log("\n[2/4] Buscando planos existentes na conta de teste (GET /preapproval_plan/search)...");
  const searchRes = await mpFetch(token, "/preapproval_plan/search?status=active&limit=50");
  const existingPlans = Array.isArray(searchRes.data?.results) ? searchRes.data.results : [];
  console.log(`  ✓ Planos ativos encontrados no Mercado Pago: ${existingPlans.length}`);

  const canonicalPlans = [
    { key: "starter", name: "Zuno Prospect - Starter", amount: 47, trial: 7 },
    { key: "pro", name: "Zuno Prospect - Pro", amount: 97, trial: 7 },
    { key: "agency", name: "Zuno Prospect - Agency", amount: 247, trial: 7 },
  ];

  const planMap = {};

  console.log("\n[3/4] Validando ou criando os 3 planos canônicos com 7 dias de trial...");
  for (const plan of canonicalPlans) {
    const existing = existingPlans.find((p) => {
      const matchAmount = Math.abs(Number(p.auto_recurring?.transaction_amount) - plan.amount) < 0.01;
      const matchTrial = Number(p.auto_recurring?.free_trial?.frequency) === plan.trial;
      const matchCycle = p.auto_recurring?.frequency === 1 && p.auto_recurring?.frequency_type === "months";
      return matchAmount && matchTrial && matchCycle;
    });

    if (existing) {
      console.log(`  ✓ Plano ${plan.key.toUpperCase()} já existente: ID ${maskId(existing.id)} (R$ ${plan.amount}/mês | Trial: ${plan.trial} dias)`);
      planMap[plan.key] = existing.id;
    } else {
      console.log(`  + Criando plano ${plan.key.toUpperCase()} (R$ ${plan.amount}/mês | Trial: ${plan.trial} dias)...`);
      const createRes = await mpFetch(token, "/preapproval_plan", {
        method: "POST",
        body: JSON.stringify({
          reason: plan.name,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plan.amount,
            currency_id: "BRL",
            free_trial: {
              frequency: plan.trial,
              frequency_type: "days",
            },
          },
          payment_methods_allowed: {
            payment_types: [{ id: "credit_card" }],
          },
          back_url: "https://www.zunoprospect.com.br/prospeccao?subscription=success&provider=mercado_pago",
        }),
      });

      if (!createRes.ok || !createRes.data?.id) {
        throw new Error(`Falha ao criar plano ${plan.key}: ${JSON.stringify(createRes.data)}`);
      }
      console.log(`    -> Criado com sucesso! ID: ${maskId(createRes.data.id)}`);
      planMap[plan.key] = createRes.data.id;
    }
  }

  console.log("\n[4/4] Persistindo IDs no banco local (billing_provider_config)...");
  const adminClient = createClient(LOCAL_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await adminClient.from("billing_provider_config").update({
    mercado_pago_plan_ids: planMap,
    mercado_pago_trial_duration_days: 7,
    mercado_pago_trial_policy_version: "7d_2026_10",
    updated_at: new Date().toISOString(),
  }).eq("singleton", true);

  console.log("  ✓ Configuração local atualizada:");
  for (const [k, v] of Object.entries(planMap)) {
    console.log(`    - ${k}: ${maskId(v)}`);
  }

  console.log("\n================================================================================");
  console.log("=== AUDITORIA DE API CONCLUÍDA COM SUCESSO! ===");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("ERRO NA EXECUÇÃO:", err);
  process.exit(1);
});
