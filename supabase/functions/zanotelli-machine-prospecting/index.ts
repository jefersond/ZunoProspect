import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emitZanotelliLeadSnapshot } from '../_shared/zanotelli-inbound-bridge.ts'

const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MACHINE_SCOPE = 'prospecting:execute'
const MAX_QUANTITY = 5
const MAX_BODY_BYTES = 8 * 1024
const MAX_MACHINE_RPM = 2
const IDEMPOTENCY_PREFIX = 'zanotelli-machine:'
const RECEIVER_URL = 'https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/zuno-inbound-bridge'
const ADMIN_USER_ID = '293cbcc2-1262-4e22-845c-8178ca1dddff'
const ADMIN_EMAIL = 'jeferson.zanotell@gmail.com'
const API_KEY_PATTERN = /^zuno_[A-Za-z0-9_-]{43,200}$/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/
const ALLOWED_KEYS = new Set(['cidade', 'estado', 'pais', 'nicho', 'quantidade', 'proximidadeAtiva', 'raioKm'])

type AdminClient = ReturnType<typeof createClient>

type AuthContext = {
  apiKeyId: string
  userId: string
  token: string
  authorization: string
  idempotencyKey: string
  payloadHash: string
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      ...headers,
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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function logRequest(
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
      ip_address: clean(params.request.headers.get('x-real-ip') ?? params.request.headers.get('x-forwarded-for'), 120) || null,
    })
  } catch {
    // Audit failures are intentionally silent to the caller.
  }
}

async function persistIdempotency(
  admin: AdminClient,
  auth: AuthContext,
  request: Request,
  requestId: string,
  startedAt: number,
  status: number,
  body: Record<string, unknown>,
) {
  const endpoint = new URL(request.url).pathname
  const { error } = await admin.from('api_idempotency_keys').insert({
    user_id: auth.userId,
    idempotency_key: auth.idempotencyKey,
    endpoint,
    payload_hash: auth.payloadHash,
    response_status: status,
    response_body: body,
  })
  await logRequest(admin, {
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    requestId,
    request,
    status: error ? 503 : status,
    startedAt,
    errorCode: error ? 'idempotency_store_failed' : null,
  })
  return error
}

async function authenticate(
  request: Request,
  admin: AdminClient,
  anonKey: string,
  supabaseUrl: string,
  rawBody: string,
  requestId: string,
  startedAt: number,
): Promise<{ auth?: AuthContext; replay?: Response; error?: Response }> {
  const token = clean(request.headers.get('x-api-key'), 512)
  if (!API_KEY_PATTERN.test(token)) return { error: json({ error: 'invalid_api_key' }, 401) }

  const tokenHash = await sha256(token)
  const { data: keyData, error: keyError } = await admin
    .from('api_keys')
    .select('id,user_id,revoked_at,expires_at,scopes,rate_limit_rpm')
    .eq('key_hash', tokenHash)
    .maybeSingle()
  if (keyError || !keyData) return { error: json({ error: 'invalid_api_key' }, 401) }

  const apiKeyId = clean(keyData.id, 80)
  const userId = clean(keyData.user_id, 80)
  if (userId !== ADMIN_USER_ID || keyData.revoked_at) return { error: json({ error: 'invalid_api_key' }, 401) }
  if (keyData.expires_at && new Date(keyData.expires_at).getTime() <= Date.now()) {
    return { error: json({ error: 'api_key_expired' }, 401) }
  }
  const scopes = Array.isArray(keyData.scopes) ? keyData.scopes : []
  if (!scopes.includes(MACHINE_SCOPE) || scopes.some((scope) => scope !== MACHINE_SCOPE)) {
    return { error: json({ error: 'insufficient_scope' }, 403) }
  }

  const { data: adminCheck, error: adminError } = await admin.rpc('is_admin', { _user_id: userId })
  const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(userId)
  if (adminError || adminCheck !== true || ownerError || clean(ownerData?.user?.email, 254).toLowerCase() !== ADMIN_EMAIL) {
    return { error: json({ error: 'machine_owner_not_allowed' }, 403) }
  }

  const rpm = Math.max(1, Math.min(MAX_MACHINE_RPM, Number(keyData.rate_limit_rpm) || 1))
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count, error: rateError } = await admin
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gt('created_at', oneMinuteAgo)
  if (rateError) return { error: json({ error: 'rate_limit_check_failed' }, 503) }
  if ((count ?? 0) >= rpm) return { error: json({ error: 'rate_limit_exceeded' }, 429) }

  const rawIdempotency = clean(request.headers.get('idempotency-key'), 160)
  if (!IDEMPOTENCY_PATTERN.test(rawIdempotency)) return { error: json({ error: 'idempotency_key_required' }, 400) }
  const idempotencyKey = `${IDEMPOTENCY_PREFIX}${rawIdempotency}`
  const payloadHash = await sha256(rawBody)
  const endpoint = new URL(request.url).pathname
  const { data: prior, error: priorError } = await admin
    .from('api_idempotency_keys')
    .select('endpoint,payload_hash,response_status,response_body')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (priorError) return { error: json({ error: 'idempotency_check_failed' }, 503) }
  if (prior) {
    if (prior.endpoint !== endpoint || prior.payload_hash !== payloadHash) {
      return { error: json({ error: 'idempotency_conflict' }, 409) }
    }
    return {
      replay: json(prior.response_body, Number(prior.response_status) || 200, { 'x-idempotency-replayed': 'true' }),
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  })
  const properties = linkData?.properties as { hashed_token?: string } | undefined
  const delegatedHash = clean(properties?.hashed_token, 2048)
  if (linkError || !delegatedHash) return { error: json({ error: 'delegated_session_failed' }, 503) }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
    token_hash: delegatedHash,
    type: 'email',
  })
  const accessToken = clean(sessionData.session?.access_token, 4096)
  if (sessionError || sessionData.user?.id !== userId || !accessToken) {
    return { error: json({ error: 'delegated_session_failed' }, 503) }
  }

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId)
  return {
    auth: {
      apiKeyId,
      userId,
      token,
      authorization: `Bearer ${accessToken}`,
      idempotencyKey,
      payloadHash,
    },
  }
}

serve(async (request) => {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (request.headers.has('origin')) return json({ error: 'browser_origin_rejected' }, 403)
  if ((request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'json_required' }, 415)
  }
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)
  let input: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_payload' }, 400)
    input = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) return json({ error: 'unknown_property' }, 400)

  const cidade = clean(input.cidade, 120)
  const estado = clean(input.estado, 120)
  const nicho = clean(input.nicho, 140)
  const pais = clean(input.pais, 2).toUpperCase() || 'BR'
  const quantidade = Number(input.quantidade)
  if (!cidade || !estado || !nicho || !['BR', 'US'].includes(pais)) return json({ error: 'invalid_search_target' }, 400)
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTITY) return json({ error: 'invalid_quantity' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRole || !encryptionKey) return json({ error: 'server_misconfigured' }, 503)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-zuno-component': 'zanotelli-machine-prospecting' } },
  })
  const authResult = await authenticate(request, admin, anonKey, supabaseUrl, rawBody, requestId, startedAt)
  if (authResult.error) return authResult.error
  if (authResult.replay) return authResult.replay
  const auth = authResult.auth
  if (!auth) return json({ error: 'unauthorized' }, 401)

  const searchPayload = {
    ...input,
    cidade,
    estado,
    nicho,
    pais,
    quantidade,
    foco: INTERNAL_FOCUS,
    canaisProspeccao: ['email'],
  }

  const searchResponse = await fetch(`${supabaseUrl}/functions/v1/buscar-leads`, {
    method: 'POST',
    headers: {
      authorization: auth.authorization,
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(searchPayload),
    signal: AbortSignal.timeout(50_000),
  })
  const searchText = (await searchResponse.text()).slice(0, 32 * 1024)
  let searchResult: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(searchText) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) searchResult = parsed as Record<string, unknown>
  } catch {
    searchResult = {}
  }
  if (!searchResponse.ok || searchResult.success !== true) {
    await logRequest(admin, {
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      requestId,
      request,
      status: searchResponse.ok ? 422 : searchResponse.status,
      startedAt,
      errorCode: 'internal_search_failed',
    })
    return json({ error: 'internal_search_failed' }, searchResponse.ok ? 422 : searchResponse.status)
  }

  const searchRunId = clean(searchResult.searchRunId, 180)
  if (!searchRunId) return json({ error: 'search_run_missing' }, 503)

  const readSearchLeads = async () => admin.rpc('set_encryption_key_and_get_leads_filtered', {
    p_encryption_key: encryptionKey,
    p_salvo: null,
    p_user_id: auth.userId,
    p_search_run_id: searchRunId,
  })

  const { data: initialLeads, error: leadsError } = await readSearchLeads()
  if (leadsError) return json({ error: 'lead_export_failed' }, 503)
  const initialRows = Array.isArray(initialLeads) ? initialLeads.slice(0, quantidade) : []

  let analysisCompleted = 0
  let analysisFailures = 0
  await Promise.all(initialRows.map(async (lead) => {
    if (!lead || typeof lead !== 'object') return
    const row = lead as Record<string, unknown>
    const leadId = clean(row.id, 180)
    if (!leadId) return
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/analisar-lead-ia`, {
        method: 'POST',
        headers: {
          authorization: auth.authorization,
          apikey: anonKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: leadId,
          objetivo: 'prospeccao_interna_zuno',
          canal: 'email',
          foco: INTERNAL_FOCUS,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      await response.body?.cancel().catch(() => undefined)
      if (response.ok) analysisCompleted += 1
      else analysisFailures += 1
    } catch {
      analysisFailures += 1
    }
  }))

  const { data: refreshedLeads, error: refreshedError } = await readSearchLeads()
  if (refreshedError) return json({ error: 'lead_refresh_failed' }, 503)
  const rows = Array.isArray(refreshedLeads) ? refreshedLeads.slice(0, quantidade) : initialRows

  const signingSecret = await sha256(`zanotelli-inbound-hmac:v1:${auth.token}`)
  let accepted = 0
  let duplicates = 0
  let failures = 0

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
    }, {
      enabled: true,
      url: RECEIVER_URL,
      secret: signingSecret,
    })

    if (result.safeCode === 'duplicate') duplicates += 1
    else if (result.accepted) accepted += 1
    else failures += 1
  }

  const complete = failures === 0 && accepted + duplicates === rows.length
  const responseBody: Record<string, unknown> = {
    success: complete,
    searchRunId,
    leadsFound: rows.length,
    opportunityAnalysis: {
      requested: initialRows.length,
      completed: analysisCompleted,
      failures: analysisFailures,
    },
    bridge: { accepted, duplicates, failures },
    outboundArmed: false,
    emailSent: 0,
    whatsappSent: 0,
    ...(complete ? {} : { error: 'bridge_delivery_incomplete' }),
  }
  const responseStatus = complete ? 200 : 502
  const idempotencyError = await persistIdempotency(admin, auth, request, requestId, startedAt, responseStatus, responseBody)
  if (idempotencyError) return json({ error: 'idempotency_store_failed' }, 503)
  return json(responseBody, responseStatus)
})
