import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emitZanotelliLeadSnapshot } from '../_shared/zanotelli-inbound-bridge.ts'

const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MACHINE_SCOPE = 'prospecting:execute'
const MAX_QUANTITY = 5
const MAX_SEARCH_QUANTITY = 25
const MAX_BODY_BYTES = 8 * 1024
const MAX_MACHINE_RPM = 2
const MAX_CRAWL_PAGES_PER_SITE = 3
const MAX_HTML_BYTES = 512 * 1024
const PAGE_FETCH_TIMEOUT_MS = 3500
const IDEMPOTENCY_PREFIX = 'zanotelli-machine:'
const RECEIVER_URL = 'https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/zuno-inbound-bridge'
const ADMIN_USER_ID = '293cbcc2-1262-4e22-845c-8178ca1dddff'
const ADMIN_EMAIL = 'jeferson.zanotell@gmail.com'
const API_KEY_PATTERN = /^zuno_[A-Za-z0-9_-]{43,200}$/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/
const ALLOWED_KEYS = new Set(['cidade', 'estado', 'pais', 'nicho', 'quantidade', 'proximidadeAtiva', 'raioKm'])
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const BLOCKED_EMAIL_PATTERN = /(?:noreply|no-reply|donotreply|do-not-reply|example|test|wix|sentry|cloudflare|wordpress|facebook|instagram|google)/i
const CONTACT_HINT_PATTERN = /(?:contato|contact|fale\s*conosco|fale-conosco|atendimento|sobre|about|quem\s*somos|quem-somos|empresa)/i

type AdminClient = ReturnType<typeof createClient>
type AuthContext = {
  apiKeyId: string
  userId: string
  token: string
  authorization: string
  idempotencyKey: string
  payloadHash: string
}
type EmailDiscovery = {
  email: string
  source: 'existing' | 'homepage' | 'contact_page'
  pagesChecked: number
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

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function nicheProfile(value: unknown) {
  const raw = clean(value, 140)
  const n = normalized(raw)
  if (/(gestor.*trafego|trafego.*pago|paid media|media buyer)/.test(n)) {
    return { label: 'gestor de tráfego', search: 'marketing digital, agencia de marketing, publicidade' }
  }
  if (/(social media|socialmedia)/.test(n)) {
    return { label: 'social media', search: 'agencia de marketing, marketing digital, publicidade' }
  }
  return { label: raw.replace(/[_-]+/g, ' ').trim(), search: raw.replace(/[_-]+/g, ' ').trim() }
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 254).toLowerCase().replace(/^mailto:/, '').split('?')[0]
  if (!email || email.length > 254 || /\s/.test(email)) return ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ''
  if (BLOCKED_EMAIL_PATTERN.test(email)) return ''
  return email
}

function validPublicEmail(row: Record<string, unknown>) {
  return normalizeEmail(row.email) || normalizeEmail(row.cnpj_email)
}

function safeWebsite(value: unknown) {
  const raw = clean(value, 500)
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!host || host === 'localhost' || host.endsWith('.local')) return null
    if (/^(?:127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null
    const private172 = host.match(/^172\.(\d{1,3})\./)
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null
    if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) return null
    parsed.hash = ''
    return parsed
  } catch {
    return null
  }
}

function extractEmail(html: string) {
  const mailtoMatches = [...html.matchAll(/mailto:([^"'?#\s>]+)/gi)]
  for (const match of mailtoMatches) {
    const candidate = normalizeEmail(match[1])
    if (candidate) return candidate
  }

  const candidates = html.match(EMAIL_PATTERN) ?? []
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate)
    if (email) return email
  }
  return ''
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function contactPageCandidates(baseUrl: URL, html: string) {
  const scored = new Map<string, number>()
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,240}?)<\/a>/gi
  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1]
    const label = stripTags(match[2])
    if (!CONTACT_HINT_PATTERN.test(`${href} ${label}`)) continue
    try {
      const candidate = new URL(href, baseUrl)
      if (!['http:', 'https:'].includes(candidate.protocol)) continue
      if (candidate.origin !== baseUrl.origin) continue
      candidate.hash = ''
      const key = candidate.toString()
      const normalizedHint = normalized(`${candidate.pathname} ${label}`)
      const score = /contato|contact|fale/.test(normalizedHint) ? 3 : /atendimento/.test(normalizedHint) ? 2 : 1
      scored.set(key, Math.max(score, scored.get(key) ?? 0))
    } catch {
      // Ignore malformed site links.
    }
  }

  const commonPaths = ['/contato', '/contact', '/fale-conosco', '/sobre', '/about']
  for (const path of commonPaths) {
    const candidate = new URL(path, baseUrl)
    const score = /contato|contact|fale/.test(path) ? 2 : 1
    scored.set(candidate.toString(), Math.max(score, scored.get(candidate.toString()) ?? 0))
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url)
    .filter((url) => url !== baseUrl.toString())
    .slice(0, MAX_CRAWL_PAGES_PER_SITE)
}

async function fetchHtml(url: URL) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'user-agent': 'ZunoProspect/1.0 public-contact-discovery',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return ''
    }
    const finalUrl = safeWebsite(response.url)
    if (!finalUrl || finalUrl.origin !== url.origin) {
      await response.body?.cancel().catch(() => undefined)
      return ''
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      await response.body?.cancel().catch(() => undefined)
      return ''
    }
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declared) && declared > MAX_HTML_BYTES * 2) {
      await response.body?.cancel().catch(() => undefined)
      return ''
    }
    return (await response.text()).slice(0, MAX_HTML_BYTES)
  } catch {
    return ''
  }
}

async function discoverPublicEmail(row: Record<string, unknown>): Promise<EmailDiscovery | null> {
  const existing = validPublicEmail(row)
  if (existing) return { email: existing, source: 'existing', pagesChecked: 0 }

  const website = safeWebsite(row.website)
  if (!website) return null
  const homepage = await fetchHtml(website)
  if (!homepage) return null

  const homepageEmail = extractEmail(homepage)
  if (homepageEmail) return { email: homepageEmail, source: 'homepage', pagesChecked: 1 }

  const candidates = contactPageCandidates(website, homepage)
  if (candidates.length === 0) return null
  const pages = await Promise.all(candidates.map(async (value) => {
    const parsed = safeWebsite(value)
    if (!parsed || parsed.origin !== website.origin) return ''
    return fetchHtml(parsed)
  }))
  for (const page of pages) {
    const email = extractEmail(page)
    if (email) return { email, source: 'contact_page', pagesChecked: 1 + pages.length }
  }
  return null
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function logRequest(
  admin: AdminClient,
  params: { apiKeyId: string; userId: string; requestId: string; request: Request; status: number; startedAt: number; errorCode?: string | null },
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
    // Logging must never weaken the fail-closed sourcing boundary.
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
  const { data: keyData, error: keyError } = await admin.from('api_keys')
    .select('id,user_id,revoked_at,expires_at,scopes,rate_limit_rpm')
    .eq('key_hash', tokenHash)
    .maybeSingle()
  if (keyError || !keyData) return { error: json({ error: 'invalid_api_key' }, 401) }

  const apiKeyId = clean(keyData.id, 80)
  const userId = clean(keyData.user_id, 80)
  if (userId !== ADMIN_USER_ID || keyData.revoked_at) return { error: json({ error: 'invalid_api_key' }, 401) }
  if (keyData.expires_at && new Date(keyData.expires_at).getTime() <= Date.now()) return { error: json({ error: 'api_key_expired' }, 401) }

  const scopes = Array.isArray(keyData.scopes) ? keyData.scopes : []
  if (!scopes.includes(MACHINE_SCOPE) || scopes.some((scope) => scope !== MACHINE_SCOPE)) {
    return { error: json({ error: 'insufficient_scope' }, 403) }
  }

  const [{ data: adminCheck, error: adminError }, { data: ownerData, error: ownerError }] = await Promise.all([
    admin.rpc('is_admin', { _user_id: userId }),
    admin.auth.admin.getUserById(userId),
  ])
  if (adminError || adminCheck !== true || ownerError || clean(ownerData?.user?.email, 254).toLowerCase() !== ADMIN_EMAIL) {
    return { error: json({ error: 'machine_owner_not_allowed' }, 403) }
  }

  const rpm = Math.max(1, Math.min(MAX_MACHINE_RPM, Number(keyData.rate_limit_rpm) || 1))
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count, error: rateError } = await admin.from('api_logs')
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
  const { data: prior, error: priorError } = await admin.from('api_idempotency_keys')
    .select('endpoint,payload_hash,response_status,response_body')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (priorError) return { error: json({ error: 'idempotency_check_failed' }, 503) }
  if (prior) {
    if (prior.endpoint !== endpoint || prior.payload_hash !== payloadHash) return { error: json({ error: 'idempotency_conflict' }, 409) }
    return { replay: json(prior.response_body, Number(prior.response_status) || 200, { 'x-idempotency-replayed': 'true' }) }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: ADMIN_EMAIL })
  const properties = linkData?.properties as { hashed_token?: string } | undefined
  const delegatedHash = clean(properties?.hashed_token, 2048)
  if (linkError || !delegatedHash) return { error: json({ error: 'delegated_session_failed' }, 503) }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({ token_hash: delegatedHash, type: 'email' })
  const accessToken = clean(sessionData.session?.access_token, 4096)
  if (sessionError || sessionData.user?.id !== userId || !accessToken) return { error: json({ error: 'delegated_session_failed' }, 503) }

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId)
  return { auth: { apiKeyId, userId, token, authorization: `Bearer ${accessToken}`, idempotencyKey, payloadHash } }
}

function snapshotFromRow(row: Record<string, unknown>, searchRunId: string, businessCategory: string) {
  return {
    externalLeadId: clean(row.id, 180),
    companyName: clean(row.nome, 180),
    city: clean(row.cidade, 120),
    businessCategory,
    website: clean(row.website, 300),
    publicEmail: validPublicEmail(row),
    publicPhone: clean(row.telefone, 40),
    instagram: clean(row.instagram_url, 180),
    externalStatus: clean(row.status, 80) || 'prospected',
    searchRunId,
    googlePlaceId: clean(row.google_place_id, 180),
  }
}

serve(async (request) => {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (request.headers.has('origin')) return json({ error: 'browser_origin_rejected' }, 403)
  if ((request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') return json({ error: 'json_required' }, 415)

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
  const requestedNiche = clean(input.nicho, 140)
  const profile = nicheProfile(requestedNiche)
  const pais = clean(input.pais, 2).toUpperCase() || 'BR'
  const quantidade = Number(input.quantidade)
  if (!cidade || !estado || !requestedNiche || !['BR', 'US'].includes(pais)) return json({ error: 'invalid_search_target' }, 400)
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

  // Search a wider provider batch, then keep only public-email leads for Zanotelli.
  // Hunter is not called here and outbound remains fail-closed.
  const searchQuantity = Math.min(MAX_SEARCH_QUANTITY, Math.max(quantidade, quantidade * 5))
  const searchPayload = {
    ...input,
    cidade,
    estado,
    nicho: profile.search,
    pais,
    quantidade: searchQuantity,
    foco: INTERNAL_FOCUS,
    canaisProspeccao: ['email'],
  }

  const searchResponse = await fetch(`${supabaseUrl}/functions/v1/buscar-leads`, {
    method: 'POST',
    headers: { authorization: auth.authorization, apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(searchPayload),
    signal: AbortSignal.timeout(50_000),
  })
  const searchText = (await searchResponse.text()).slice(0, 64 * 1024)
  let searchResult: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(searchText) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) searchResult = parsed as Record<string, unknown>
  } catch {
    // Sanitized error below.
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

  // Always re-read the search run from Zuno's encrypted store. The public response
  // intentionally contains a reduced lead shape and is not authoritative for e-mail.
  const { data, error } = await admin.rpc('set_encryption_key_and_get_leads_filtered', {
    p_encryption_key: encryptionKey,
    p_salvo: null,
    p_user_id: auth.userId,
    p_search_run_id: searchRunId,
  })
  if (error) return json({ error: 'lead_export_failed' }, 503)
  const candidateRows = Array.isArray(data)
    ? data.filter((item) => item && typeof item === 'object') as Record<string, unknown>[]
    : []

  const rows: Record<string, unknown>[] = []
  let candidatesInspected = 0
  let discardedWithoutEmail = 0
  let existingEmailCount = 0
  let homepageEmailCount = 0
  let contactPageEmailCount = 0
  let crawlPagesChecked = 0
  const batchSize = 5

  for (let offset = 0; offset < candidateRows.length && rows.length < quantidade; offset += batchSize) {
    const batch = candidateRows.slice(offset, offset + batchSize)
    const discoveries = await Promise.all(batch.map(async (row) => {
      const discovery = await discoverPublicEmail(row)
      return { row, discovery }
    }))

    for (const { row, discovery } of discoveries) {
      candidatesInspected += 1
      if (!discovery) {
        discardedWithoutEmail += 1
        continue
      }
      crawlPagesChecked += discovery.pagesChecked
      if (discovery.source === 'existing') existingEmailCount += 1
      else if (discovery.source === 'homepage') homepageEmailCount += 1
      else contactPageEmailCount += 1
      if (rows.length < quantidade) rows.push({ ...row, email: discovery.email })
    }
  }

  const signingSecret = await sha256(`zanotelli-inbound-hmac:v1:${auth.token}`)
  const bridgeResults = await Promise.all(rows.map(async (row) => {
    const snapshot = snapshotFromRow(row, searchRunId, profile.label)
    if (!snapshot.externalLeadId || !snapshot.companyName || !snapshot.publicEmail) return { accepted: false, safeCode: 'invalid_email_lead' }
    return emitZanotelliLeadSnapshot(snapshot, { enabled: true, url: RECEIVER_URL, secret: signingSecret })
  }))

  let accepted = 0
  let duplicates = 0
  let failures = 0
  for (const result of bridgeResults) {
    if (result.safeCode === 'duplicate' || result.safeCode === 'updated' || result.safeCode === 'possible_duplicate') duplicates += 1
    else if (result.accepted) accepted += 1
    else failures += 1
  }

  const complete = failures === 0 && accepted + duplicates === rows.length
  const responseBody: Record<string, unknown> = {
    success: complete,
    searchRunId,
    leadsFound: rows.length,
    nativeEmailOnly: true,
    candidatesAvailable: candidateRows.length,
    candidatesInspected,
    discardedWithoutEmail,
    emailDiscovery: {
      existing: existingEmailCount,
      homepage: homepageEmailCount,
      contactPage: contactPageEmailCount,
      pagesChecked: crawlPagesChecked,
    },
    requestedFinalLeads: quantidade,
    providerSearchQuantity: searchQuantity,
    bridge: { accepted, duplicates, failures },
    searchProfile: { requestedNiche, normalizedNiche: profile.label, providerQuery: profile.search },
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
