#!/usr/bin/env node
// Disparo manual e único de um technical_event de sandbox para o
// ZunoInboundBridge (Zuno Prospect -> Zanotelli OS). Nunca roda sozinho,
// nunca é chamado pelo app, nunca envia lead ou dado real. Segredo só por
// variável de ambiente local — nunca versionado, nunca impresso.
//
// Uso:
//   ZANOTELLI_BRIDGE_ENABLED=true \
//   ZANOTELLI_BRIDGE_URL=https://SEU-PREVIEW.vercel.app/api/integrations/zuno/events \
//   ZANOTELLI_BRIDGE_SECRET=segredo-de-sandbox-local \
//   ZANOTELLI_BRIDGE_ENVIRONMENT=sandbox \
//   npm run zanotelli:test-bridge

import { webcrypto } from 'node:crypto'

function assertNotProduction(env) {
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production' || env.ZANOTELLI_BRIDGE_ENVIRONMENT === 'production') {
    console.error('Execução bloqueada: ambiente de produção detectado.')
    process.exit(1)
  }
}

function maskIdentifier(value) {
  if (!value || value.length <= 8) return '*'.repeat(value?.length ?? 0)
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

async function signHmacSha256(message, secret) {
  const encoder = new TextEncoder()
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await webcrypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildSandboxTechnicalEvent() {
  return {
    event_type: 'technical_event',
    event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    source: 'zuno-prospect',
    environment: 'sandbox',
    feature: 'refine_with_ai',
    // O contrato real só aceita low/medium/high/critical -- "warning" não
    // existe. "medium" é o equivalente mais próximo de um aviso não crítico.
    severity: 'medium',
    error_code: 'SANDBOX_CONNECTION_TEST',
    safe_message: 'Evento técnico simulado para validar a integração com o Zanotelli OS.',
    // anonymous_user_reference é omitido de propósito: o contrato trata um
    // valor `null` explícito como inválido, só aceita string ou ausência.
    metadata: { simulated: true, origin: 'manual_test', contains_real_user_data: false },
    idempotency_key: crypto.randomUUID(),
  }
}

async function main() {
  assertNotProduction(process.env)

  const enabled = process.env.ZANOTELLI_BRIDGE_ENABLED === 'true'
  const url = process.env.ZANOTELLI_BRIDGE_URL
  const secret = process.env.ZANOTELLI_BRIDGE_SECRET

  if (!enabled) {
    console.log(JSON.stringify({ status: 'bridge_disabled', detail: 'ZANOTELLI_BRIDGE_ENABLED não é "true".' }, null, 2))
    return
  }
  if (!url) {
    console.error('ZANOTELLI_BRIDGE_URL ausente. Configure localmente, sem versionar.')
    process.exit(1)
  }
  if (!secret) {
    console.error('ZANOTELLI_BRIDGE_SECRET ausente. Configure localmente, sem versionar.')
    process.exit(1)
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    console.error('ZANOTELLI_BRIDGE_URL inválida.')
    process.exit(1)
  }
  if (parsedUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) {
    console.error('ZANOTELLI_BRIDGE_URL deve usar https:// fora de ambiente local.')
    process.exit(1)
  }

  const event = buildSandboxTechnicalEvent()
  const timestampSeconds = Math.floor(Date.now() / 1000)
  const rawBody = JSON.stringify(event)
  const signature = await signHmacSha256(`${timestampSeconds}.${rawBody}`, secret)

  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(parsedUrl, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-zuno-timestamp': String(timestampSeconds),
        'x-zuno-signature': signature,
        'x-zuno-event-id': event.event_id,
      },
      body: rawBody,
    })
    const durationMs = Math.round(performance.now() - startedAt)
    let json = {}
    try {
      json = await response.json()
    } catch {
      json = {}
    }
    console.log(JSON.stringify({
      http_status: response.status,
      status: json.status ?? 'unknown',
      event_id: maskIdentifier(event.event_id),
      duration_ms: durationMs,
    }, null, 2))
  } catch (cause) {
    const durationMs = Math.round(performance.now() - startedAt)
    const aborted = controller.signal.aborted
    console.log(JSON.stringify({
      status: 'temporarily_unavailable',
      error: aborted ? 'timeout' : 'network_error',
      event_id: maskIdentifier(event.event_id),
      duration_ms: durationMs,
    }, null, 2))
  } finally {
    clearTimeout(timeout)
  }
}

await main()
