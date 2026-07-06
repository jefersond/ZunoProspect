// Script de Teste E2E para API de Integração Zuno Prospect
// Como rodar: node .tmp/test_api_integration.js <URL_DA_API> <API_KEY_ADMIN> <API_KEY_COMUM> <LEAD_ID_TESTE>

import { Hash } from "crypto";

const args = process.argv.slice(2);
const apiBaseUrl = args[0] || 'https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/api-leads';
const apiKeyAdmin = args[1];
const apiKeyComum = args[2];
const leadIdTeste = args[3];

if (!apiKeyAdmin || !apiKeyComum || !leadIdTeste) {
  console.error("Erro: Parâmetros ausentes!");
  console.log("Uso: node .tmp/test_api_integration.js <URL_DA_API> <API_KEY_ADMIN> <API_KEY_COMUM> <LEAD_ID_TESTE>");
  process.exit(1);
}

// SHA-256 local
async function sha256(text) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

async function runTests() {
  console.log("========== INICIANDO TESTES E2E DA API EXTERNA ==========");
  console.log(`API URL: ${apiBaseUrl}`);
  console.log(`Lead ID de Teste: ${leadIdTeste}`);

  let testLockToken = "";

  // ----------------------------------------------------
  // TESTE 1: Acesso de não-admin (HTTP 403)
  // ----------------------------------------------------
  console.log("\n[Teste 1] Validando acesso de não-admin...");
  try {
    const res = await fetch(`${apiBaseUrl}/pending`, {
      headers: {
        'x-api-key': apiKeyComum,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 403 && data.error?.code === 'ADMIN_ACCESS_REQUIRED') {
      console.log("✅ Teste 1 passou: Acesso negado com 403 ADMIN_ACCESS_REQUIRED.");
    } else {
      console.error("❌ Teste 1 falhou: Esperado 403 com erro de admin.");
    }
  } catch (err) {
    console.error("❌ Teste 1 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 2: Acesso de admin (HTTP 200)
  // ----------------------------------------------------
  console.log("\n[Teste 2] Validando acesso de admin...");
  try {
    const res = await fetch(`${apiBaseUrl}/pending`, {
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Total de leads pendentes encontrados:", data.data?.length || 0);

    if (res.status === 200) {
      console.log("✅ Teste 2 passou: Acesso autorizado para admin.");
    } else {
      console.error("❌ Teste 2 falhou: Esperado 200 OK.");
    }
  } catch (err) {
    console.error("❌ Teste 2 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 3: Reserva atômica com Lock (Claim)
  // ----------------------------------------------------
  console.log("\n[Teste 3] Validando claim do lead...");
  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 200 && data.processing_lock_token) {
      testLockToken = data.processing_lock_token;
      console.log(`✅ Teste 3 passou: Lead reservado. Lock Token: ${testLockToken}`);
    } else {
      console.error("❌ Teste 3 falhou: Esperado 200 com lock token.");
    }
  } catch (err) {
    console.error("❌ Teste 3 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 4: Concorrência de Claim (HTTP 409)
  // ----------------------------------------------------
  console.log("\n[Teste 4] Validando conflito de concorrência (Claim duplicado)...");
  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 409 && data.error?.code === 'PROCESSING_CONFLICT') {
      console.log("✅ Teste 4 passou: Conflito detectado com sucesso (HTTP 409 PROCESSING_CONFLICT).");
    } else {
      console.error("❌ Teste 4 falhou: Esperado 409.");
    }
  } catch (err) {
    console.error("❌ Teste 4 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 5: Submissão com Lock Token Inválido (HTTP 422)
  // ----------------------------------------------------
  console.log("\n[Teste 5] Validando submissão com lock token inválido...");
  const fakePayload = {
    lock_token: 'fake-token-1234',
    agent_name: 'test_agent',
    model_used: 'claude-3-5-sonnet',
    priority: 'high',
    opportunity_summary: 'Diagnóstico comercial de teste.',
    possible_pain: 'Sem presença digital.',
    approach_angle: 'Oferecer automação.',
    whatsapp_message: 'Olá, testando...',
    instagram_message: 'Mensagem insta...',
    email_subject: 'Assunto teste',
    email_body: 'Corpo e-mail teste',
    follow_up_message: 'Follow-up teste'
  };

  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fakePayload)
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 422 && data.error?.code === 'INVALID_LOCK_TOKEN') {
      console.log("✅ Teste 5 passou: Rejeitado por token inválido.");
    } else {
      console.error("❌ Teste 5 falhou: Esperado 422.");
    }
  } catch (err) {
    console.error("❌ Teste 5 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 6: Submissão com Lock Token Correto e Idempotência (HTTP 201)
  // ----------------------------------------------------
  console.log("\n[Teste 6] Validando submissão bem-sucedida...");
  const correctPayload = { ...fakePayload, lock_token: testLockToken };
  const idempotencyKey = `idemp-key-${crypto.randomUUID()}`;

  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(correctPayload)
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 201 && data.success) {
      console.log("✅ Teste 6 passou: Análise registrada com sucesso (HTTP 201).");
    } else {
      console.error("❌ Teste 6 falhou: Esperado 201.");
    }
  } catch (err) {
    console.error("❌ Teste 6 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 7: Idempotência com mesma chave e payload (HTTP 201 HIT)
  // ----------------------------------------------------
  console.log("\n[Teste 7] Validando idempotência com mesmo payload...");
  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(correctPayload)
    });

    console.log(`Status retornado: ${res.status}`);
    console.log(`Header X-Cache-Lookup: ${res.headers.get('X-Cache-Lookup')}`);
    const data = await res.json();
    console.log("Response:", data);

    if ((res.status === 201 || res.status === 200) && res.headers.get('X-Cache-Lookup') === 'HIT') {
      console.log("✅ Teste 7 passou: Resposta em cache retornada com X-Cache-Lookup: HIT.");
    } else {
      console.error("❌ Teste 7 falhou: Esperado hit em cache.");
    }
  } catch (err) {
    console.error("❌ Teste 7 falhou com erro de rede:", err);
  }

  // ----------------------------------------------------
  // TESTE 8: Idempotência com payload colidindo (HTTP 400)
  // ----------------------------------------------------
  console.log("\n[Teste 8] Validando idempotência com colisão de payload...");
  const differentPayload = { ...correctPayload, priority: 'low' };

  try {
    const res = await fetch(`${apiBaseUrl}/${leadIdTeste}/analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyAdmin}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(differentPayload)
    });

    console.log(`Status retornado: ${res.status}`);
    const data = await res.json();
    console.log("Response:", data);

    if (res.status === 400 && data.error?.code === 'INVALID_PAYLOAD') {
      console.log("✅ Teste 8 passou: Colisão de payload bloqueada com sucesso.");
    } else {
      console.error("❌ Teste 8 falhou: Esperado HTTP 400.");
    }
  } catch (err) {
    console.error("❌ Teste 8 falhou com erro de rede:", err);
  }

  console.log("\n========== TESTES CONCLUÍDOS ==========");
}

runTests();
