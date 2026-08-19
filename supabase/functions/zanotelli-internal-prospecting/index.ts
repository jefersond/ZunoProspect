import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emitZanotelliLeadSnapshot } from '../_shared/zanotelli-inbound-bridge.ts'

const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MACHINE_SCOPE = 'prospecting:execute'
const MAX_QUANTITY = 25
const MAX_MACHINE_RPM = 5
const IDEMPOTENCY_PREFIX = 'zanotelli-prospect:'
const ADMIN_EMAILS = new Set([
  'jeferson.zanotell@gmail.com',
  'jefeson.zanotell@gmail.com',
])

type AdminClient = ReturnType<typeof createClient>

type MachineAuth = {
  apiKeyId: string
  userId: string
  email: string
  authorization: string
  idempotencyKey: string
  payloadHash: string
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function extractApiKey(request: Request) {
  const direct = clean(request.headers.get('x-api-key'), 512)
  if (direct) return direct

  const authorization = clean(request.headers.get('authorization'), 1024)
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const bearer = clean(match?.[1], 512)
  return bearer.startsWith('zuno_') ? bearer : ''
}

function validIdempotencyKey(value: string) {
  return /^[A-Za-z0-9._:-]{8,160}$/.test(value)
}

async function logMachineRequest(
  admin: AdminClient,
  params: {
    apiKeyId: string
    userId: string
    requestId: string
    request: Request
    status: number
    startedAt: number
    errorCode?: string | null
  },
) {
  try {
    await admin.from('api_logs').insert({
      api_key_id: params.apiKeyId,
      user_id: params.userId,
      endpoint: new URL(params.request.url).pathname,
      method: params.request.method,
      status_code: params.status,
      duration_ms: Date.now() - params.startedAt,
      request_id: params.requestId,
      error_code: params.errorCode ?? null,
      error_message: null,
      ip_address: clean(
        params.request.headers.get('x-real-ip') ?? params.request.headers.get('x-forwarded-for'),
        120,
      ) || null,
    })
  } catch {
    // Audit failure must not leak provider or credential details to the caller.
  }
}

async function authenticateMachine(
  request: Request,
  admin: AdminClient,
  anonKey: string,
  supabaseUrl: string,
  rawBody: string,
  requestId: string,
  startedAt: number,
): Promise<{ auth?: MachineAuth; replay?: Response; error?: Response }> {
  const token = extractApiKey(request)
  if (!token) return {}
  if (!token.startsWith('zuno_')) return { error: json({ error: 'invalid_api_key' }, 401) }

  const tokenHash = await sha256(token)
  const { data: keyData, error: keyError } = await admin
    .from('api_keys')
    .select('id, user_id, revoked_at, expires_at, scopes, rate_limit_rpm')
    .eq('key_hash', tokenHash)
    .maybeSingle()

  if (keyError || !keyData) return { error: json({ error: 'invalid_api_key' }, 401) }

  const apiKeyId = clean(keyData.id, 80)
  const userId = clean(keyData.user_id, 80)
  if (!apiKeyId || !userId) return { error: json({ error: 'invalid_api_key' }, 401) }

  if (keyData.revoked_at) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 401,
      startedAt,
      errorCode: 'api_key_revoked',
    })
    return { error: json({ error: 'api_key_revoked' }, 401) }
  }

  if (keyData.expires_at && new Date(keyData.expires_at).getTime() <= Date.now()) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 401,
      startedAt,
      errorCode: 'api_key_expired',
    })
    return { error: json({ error: 'api_key_expired' }, 401) }
  }

  const scopes = Array.isArray(keyData.scopes)
    ? keyData.scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  if (!scopes.includes(MACHINE_SCOPE)) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 403,
      startedAt,
      errorCode: 'insufficient_scope',
    })
    return { error: json({ error: 'insufficient_scope', required_scope: MACHINE_SCOPE }, 403) }
  }

  const { data: adminCheck, error: adminCheckError } = await admin.rpc('is_admin', { _user_id: userId })
  if (adminCheckError || adminCheck !== true) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 403,
      startedAt,
      errorCode: 'admin_only',
    })
    return { error: json({ error: 'admin_only' }, 403) }
  }

  const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(userId)
  const email = clean(ownerData?.user?.email, 254).toLowerCase()
  if (ownerError || !ownerData?.user || !ADMIN_EMAILS.has(email)) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 403,
      startedAt,
      errorCode: 'machine_owner_not_allowed',
    })
    return { error: json({ error: 'machine_owner_not_allowed' }, 403) }
  }

  const configuredRpm = Number(keyData.rate_limit_rpm) || 1
  const rateLimitRpm = Math.max(1, Math.min(MAX_MACHINE_RPM, configuredRpm))
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count: recentRequests, error: rateError } = await admin
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gt('created_at', oneMinuteAgo)

  if (rateError) return { error: json({ error: 'rate_limit_check_failed' }, 503) }
  if ((recentRequests ?? 0) >= rateLimitRpm) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 429,
      startedAt,
      errorCode: 'rate_limit_exceeded',
    })
    return { error: json({ error: 'rate_limit_exceeded' }, 429) }
  }

  const rawIdempotency = clean(request.headers.get('idempotency-key'), 160)
  if (!validIdempotencyKey(rawIdempotency)) {
    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: 400,
      startedAt,
      errorCode: 'idempotency_key_required',
    })
    return { error: json({ error: 'idempotency_key_required' }, 400) }
  }

  const idempotencyKey = `${IDEMPOTENCY_PREFIX}${rawIdempotency}`
  const payloadHash = await sha256(rawBody || '{}')
  const { data: replayData, error: replayError } = await admin
    .from('api_idempotency_keys')
    .select('endpoint, payload_hash, response_status, response_body')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (replayError) return { error: json({ error: 'idempotency_check_failed' }, 503) }
  if (replayData) {
    const endpoint = new URL(request.url).pathname
    if (replayData.endpoint !== endpoint || replayData.payload_hash !== payloadHash) {
      await logMachineRequest(admin, {
        apiKeyId,
        userId,
        requestId,
        request,
        status: 409,
        startedAt,
        errorCode: 'idempotency_conflict',
      })
      return { error: json({ error: 'idempotency_conflict' }, 409) }
    }

    await logMachineRequest(admin, {
      apiKeyId,
      userId,
      requestId,
      request,
      status: Number(replayData.response_status) || 200,
      startedAt,
    })
    return {
      replay: json(
        replayData.response_body,
        Number(replayData.response_status) || 200,
        { 'x-idempotency-replayed': 'true' },
      ),
    }
  }

  // The mature search path is JWT-only. Generate a one-request delegated user
  // session from the API-key owner without storing the user's password or a
  // persistent refresh token. generateLink does not send the magic link.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const properties = linkData?.properties as { hashed_token?: string } | undefined
  const tokenHashForOtp = clean(properties?.hashed_token, 2048)
  if (linkError || !tokenHashForOtp) return { error: json({ error: 'delegated_session_failed' }, 503) }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
    token_hash: tokenHashForOtp,
    type: 'email',
  })
  const accessToken = clean(sessionData.session?.access_token, 4096)
  if (sessionError || !accessToken || sessionData.user?.id !== userId) {
    return { error: json({ error: 'delegated_session_failed' }, 503) }
  }

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId)

  return {
    auth: {
      apiKeyId,
      userId,
      email,
      authorization: `Bearer ${accessToken}`,
      idempotencyKey,
      payloadHash,
    },
  }
}

async function persistMachineResult(
  admin: AdminClient,
  machine: MachineAuth,
  request: Request,
  requestId: string,
  startedAt: number,
  responseBody: Record<string, unknown>,
) {
  const endpoint = new URL(request.url).pathname
  const { error: idempotencyError } = await admin.from('api_idempotency_keys').insert({
    user_id: machine.userId,
    idempotency_key: machine.idempotencyKey,
    endpoint,
    payload_hash: machine.payloadHash,
    response_status: 200,
    response_body: responseBody,
  })

  await logMachineRequest(admin, {
    apiKeyId: machine.apiKeyId,
    userId: machine.userId,
    requestId,
    request,
    status: idempotencyError ? 503 : 200,
    startedAt,
    errorCode: idempotencyError ? 'idempotency_store_failed' : null,
  })

  return idempotencyError
}

serve(async (request) => {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'json_required' }, 415)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRole || !encryptionKey) {
    return json({ error: 'server_misconfigured' }, 503)
  }

  let rawBody = ''
  let input: Record<string, unknown>
  try {
    rawBody = await request.text()
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_payload' }, 400)
    input = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const machineResult = await authenticateMachine(
    request,
    admin,
    anonKey,
    supabaseUrl,
    rawBody,
    requestId,
    startedAt,
  )
  if (machineResult.error) return machineResult.error
  if (machineResult.replay) return machineResult.replay

  let userId = ''
  let authorization = ''

  if (machineResult.auth) {
    userId = machineResult.auth.userId
    authorization = machineResult.auth.authorization
  } else {
    authorization = clean(request.headers.get('authorization'), 4096)
    if (!authorization) return json({ error: 'unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'unauthorized' }, 401)

    const normalizedEmail = clean(user.email, 254).toLowerCase()
    const { data: adminCheck, error: adminCheckError } = await admin.rpc('is_admin', { _user_id: user.id })
    if (adminCheckError) return json({ error: 'admin_check_failed' }, 503)
    if (!ADMIN_EMAILS.has(normalizedEmail) && adminCheck !== true) {
      return json({ error: 'admin_only' }, 403)
    }
    userId = user.id
  }

  const quantity = Math.max(1, Math.min(MAX_QUANTITY, Number(input.quantidade) || 5))
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
    if (machineResult.auth) {
      await logMachineRequest(admin, {
        apiKeyId: machineResult.auth.apiKeyId,
        userId,
        requestId,
        request,
        status: searchResponse.ok ? 422 : searchResponse.status,
        startedAt,
        errorCode: 'internal_search_failed',
      })
    }
    return json({
      error: 'internal_search_failed',
      status: searchResponse.status,
      code: clean(searchResult.code, 80) || null,
      noLeadsReason: clean(searchResult.noLeadsReason, 80) || null,
    }, searchResponse.ok ? 422 : searchResponse.status)
  }

  const searchRunId = clean(searchResult.searchRunId, 180)
  if (!searchRunId) return json({ error: 'search_run_missing' }, 503)

  // Read only the authenticated admin's leads generated by this exact search.
  // The RPC owns decryption and verifies p_user_id ownership.
  const { data: leads, error: leadsError } = await admin.rpc('set_encryption_key_and_get_leads_filtered', {
    p_encryption_key: encryptionKey,
    p_salvo: null,
    p_user_id: userId,
    p_search_run_id: searchRunId,
  })
  if (leadsError) return json({ error: 'lead_export_failed' }, 503)

  const rows = Array.isArray(leads) ? leads.slice(0, quantity) : []
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
    })

    if (result.safeCode === 'duplicate') duplicates += 1
    else if (result.accepted) accepted += 1
    else if (!result.attempted) bridgeDisabled += 1
    else bridgeFailures += 1
  }

  const responseBody: Record<string, unknown> = {
    success: true,
    searchRunId,
    leadsFound: rows.length,
    bridge: {
      accepted,
      duplicates,
      failures: bridgeFailures,
      disabled: bridgeDisabled,
    },
    outboundArmed: false,
    emailSent: 0,
    whatsappSent: 0,
  }

  if (machineResult.auth) {
    const idempotencyStoreError = await persistMachineResult(
      admin,
      machineResult.auth,
      request,
      requestId,
      startedAt,
      responseBody,
    )
    if (idempotencyStoreError) return json({ error: 'idempotency_store_failed' }, 503)
  }

  return json(responseBody, 200)
})