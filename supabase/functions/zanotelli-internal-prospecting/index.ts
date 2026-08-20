import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emitZanotelliLeadSnapshot } from '../_shared/zanotelli-inbound-bridge.ts'

const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MAX_QUANTITY = 25
const MAX_MACHINE_QUANTITY = 5
const MAX_OPPORTUNITY_ANALYSES = 5
const MACHINE_REPLAY_WINDOW_SECONDS = 300
const ADMIN_EMAILS = new Set([
  'jeferson.zanotell@gmail.com',
  'jefeson.zanotell@gmail.com',
])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  })
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function opportunityScore(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(message: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

async function verifyMachineRequest(request: Request, rawBody: string, secret: string) {
  if (request.headers.has('origin')) return false
  if (secret.length < 32) return false

  const timestamp = clean(request.headers.get('x-zanotelli-timestamp'), 20)
  const supplied = clean(request.headers.get('x-zanotelli-signature'), 80).toLowerCase()
  if (!/^\d{10,13}$/.test(timestamp) || !/^sha256=[0-9a-f]{64}$/.test(supplied)) return false

  const numericTimestamp = Number(timestamp)
  const timestampSeconds = timestamp.length === 13 ? Math.floor(numericTimestamp / 1000) : numericTimestamp
  if (!Number.isFinite(timestampSeconds)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > MACHINE_REPLAY_WINDOW_SECONDS) return false

  const expected = `sha256=${await hmacSha256(`${timestamp}.${rawBody}`, secret)}`
  return constantTimeEqual(expected, supplied)
}

serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'json_required' }, 415)
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) return json({ error: 'payload_too_large' }, 413)

  let input: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawBody || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_payload' }, 400)
    input = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY') ?? ''
  const machineSecret = Deno.env.get('ZANOTELLI_MACHINE_PROSPECTING_SECRET') ?? ''
  const machineAdminEmail = clean(Deno.env.get('ZANOTELLI_MACHINE_ADMIN_EMAIL'), 254).toLowerCase()
  const callerAuthorization = request.headers.get('authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRole || !encryptionKey) {
    return json({ error: 'server_misconfigured' }, 503)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  let authorization = callerAuthorization
  let authMode: 'user' | 'machine' = 'user'

  if (!authorization) {
    authMode = 'machine'
    if (!machineAdminEmail || !ADMIN_EMAILS.has(machineAdminEmail)) return json({ error: 'machine_identity_misconfigured' }, 503)
    if (!(await verifyMachineRequest(request, rawBody, machineSecret))) return json({ error: 'machine_unauthorized' }, 401)

    // Generate a one-time server-side auth link without sending email, then exchange
    // its token hash for a short-lived user session. The resulting JWT is used only
    // inside this request and is never returned or persisted.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: machineAdminEmail,
    })
    const tokenHash = linkData?.properties?.hashed_token ?? ''
    const generatedEmail = clean(linkData?.user?.email, 254).toLowerCase()
    if (linkError || !tokenHash || generatedEmail !== machineAdminEmail) {
      return json({ error: 'machine_session_generation_failed' }, 503)
    }

    const sessionClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: sessionData, error: sessionError } = await sessionClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })
    const accessToken = sessionData?.session?.access_token ?? ''
    const sessionEmail = clean(sessionData?.user?.email, 254).toLowerCase()
    if (sessionError || !accessToken || sessionEmail !== machineAdminEmail) {
      return json({ error: 'machine_session_exchange_failed' }, 503)
    }
    authorization = `Bearer ${accessToken}`
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  const normalizedEmail = clean(user.email, 254).toLowerCase()
  const { data: adminCheck, error: adminCheckError } = await admin.rpc('is_admin', { _user_id: user.id })
  if (adminCheckError) return json({ error: 'admin_check_failed' }, 503)
  if (!ADMIN_EMAILS.has(normalizedEmail) && adminCheck !== true) {
    return json({ error: 'admin_only' }, 403)
  }
  if (authMode === 'machine' && normalizedEmail !== machineAdminEmail) {
    return json({ error: 'machine_identity_mismatch' }, 403)
  }

  const quantityLimit = authMode === 'machine' ? MAX_MACHINE_QUANTITY : MAX_QUANTITY
  const quantity = Math.max(1, Math.min(quantityLimit, Number(input.quantidade) || 5))
  const searchPayload = {
    ...input,
    quantidade: quantity,
    foco: INTERNAL_FOCUS,
    canaisProspeccao: ['email'],
  }

  // Reuse the mature search/enrichment path instead of duplicating Google,
  // encryption, quota and deduplication logic here.
  const searchResponse = await fetch(`${supabaseUrl}/functions/v1/buscar-leads`, {
    method: 'POST',
    headers: {
      authorization,
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(searchPayload),
    signal: AbortSignal.timeout(45_000),
  })

  const searchText = await searchResponse.text()
  let searchResult: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(searchText) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) searchResult = parsed as Record<string, unknown>
  } catch {
    searchResult = {}
  }

  if (!searchResponse.ok || searchResult.success !== true) {
    return json({
      error: 'internal_search_failed',
      status: searchResponse.status,
      code: clean(searchResult.code, 80) || null,
      noLeadsReason: clean(searchResult.noLeadsReason, 80) || null,
    }, searchResponse.ok ? 422 : searchResponse.status)
  }

  const searchRunId = clean(searchResult.searchRunId, 180)
  if (!searchRunId) return json({ error: 'search_run_missing' }, 503)

  const readOwnedSearchLeads = async () => {
    return await admin.rpc('set_encryption_key_and_get_leads_filtered', {
      p_encryption_key: encryptionKey,
      p_salvo: null,
      p_user_id: user.id,
      p_search_run_id: searchRunId,
    })
  }

  // Read only the authenticated admin's leads generated by this exact search.
  // The RPC owns decryption and verifies p_user_id ownership.
  const { data: initialLeads, error: leadsError } = await readOwnedSearchLeads()
  if (leadsError) return json({ error: 'lead_export_failed' }, 503)

  const initialRows = Array.isArray(initialLeads) ? initialLeads.slice(0, quantity) : []
  const candidatesForAnalysis = initialRows
    .map((lead) => (lead && typeof lead === 'object' ? lead as Record<string, unknown> : null))
    .filter((lead): lead is Record<string, unknown> => Boolean(lead && clean(lead.id, 180)))
    .slice(0, MAX_OPPORTUNITY_ANALYSES)

  let analysesCompleted = 0
  let analysisFailures = 0

  // The search path intentionally does not auto-run AI. For the internal Zanotelli
  // bridge we enrich only the first five prospects, using the same authenticated
  // admin account and the existing analysis function. This populates the existing
  // probabilidade_conversao/diagnostic/signal fields without creating any send.
  await Promise.all(candidatesForAnalysis.map(async (lead) => {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/analisar-lead-ia`, {
        method: 'POST',
        headers: {
          authorization,
          apikey: anonKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: clean(lead.id, 180),
          objetivo: 'prospeccao_interna_zuno',
          canal: 'email',
          foco: INTERNAL_FOCUS,
        }),
        signal: AbortSignal.timeout(25_000),
      })
      await response.body?.cancel().catch(() => undefined)
      if (response.ok) analysesCompleted += 1
      else analysisFailures += 1
    } catch {
      analysisFailures += 1
    }
  }))

  // Re-read the exact search so snapshots carry the newly persisted opportunity
  // score and diagnostics when analysis completed. Analysis failure never turns
  // into an outbound permission and never blocks the safe snapshot export.
  const { data: refreshedLeads, error: refreshedError } = await readOwnedSearchLeads()
  if (refreshedError) return json({ error: 'lead_refresh_failed' }, 503)

  const rows = Array.isArray(refreshedLeads) ? refreshedLeads.slice(0, quantity) : initialRows
  let accepted = 0
  let duplicates = 0
  let bridgeFailures = 0
  let bridgeDisabled = 0

  for (const lead of rows) {
    if (!lead || typeof lead !== 'object') continue
    const row = lead as Record<string, unknown>
    const externalLeadId = clean(row.id, 180)
    const companyName = clean(row.nome, 180)
    if (!externalLeadId || !companyName) continue

    const result = await emitZanotelliLeadSnapshot({
      externalLeadId,
      companyName,
      city: clean(row.cidade, 120),
      businessCategory: clean(row.nicho, 140),
      website: clean(row.website, 300),
      publicEmail: clean(row.email, 200),
      publicPhone: clean(row.telefone, 40),
      instagram: clean(row.instagram_url, 180),
      externalStatus: clean(row.status, 80) || 'prospected',
      searchRunId,
      googlePlaceId: clean(row.google_place_id, 180),
      opportunityScore: opportunityScore(row.probabilidade_conversao),
      diagnostics: row.diagnostico_bullets,
      digitalSignals: row.sinais_digitais,
    })

    if (result.safeCode === 'duplicate') duplicates += 1
    else if (result.accepted) accepted += 1
    else if (!result.attempted) bridgeDisabled += 1
    else bridgeFailures += 1
  }

  return json({
    success: true,
    authMode,
    searchRunId,
    leadsFound: rows.length,
    opportunityAnalysis: {
      requested: candidatesForAnalysis.length,
      completed: analysesCompleted,
      failures: analysisFailures,
      maxPerRun: MAX_OPPORTUNITY_ANALYSES,
    },
    bridge: {
      accepted,
      duplicates,
      failures: bridgeFailures,
      disabled: bridgeDisabled,
    },
    outboundArmed: false,
    emailSent: 0,
    whatsappSent: 0,
  }, 200)
})
