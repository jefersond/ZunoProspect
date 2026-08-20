const BRIDGE_SOURCE = 'zuno-prospect-internal'
const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MAX_RESPONSE_BYTES = 8 * 1024
const MAX_DIAGNOSTICS = 4
const MAX_DIGITAL_SIGNALS = 16

export interface ZanotelliLeadSnapshotInput {
  externalLeadId: string
  companyName: string
  city?: string | null
  businessCategory?: string | null
  website?: string | null
  publicEmail?: string | null
  publicPhone?: string | null
  instagram?: string | null
  externalStatus?: string | null
  searchRunId?: string | null
  googlePlaceId?: string | null
  opportunityScore?: number | null
  diagnostics?: unknown
  digitalSignals?: unknown
}

export interface ZanotelliBridgeConfig {
  enabled: boolean
  url: string
  secret: string
}

export interface ZanotelliBridgeResult {
  attempted: boolean
  accepted: boolean
  status: number | null
  safeCode: string
}

function clean(value: string | null | undefined, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function boundedOpportunityScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

function boundedDiagnostics(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map((item) => clean(typeof item === 'string' ? item : '', 240))
    .filter(Boolean)
    .slice(0, MAX_DIAGNOSTICS)
}

function boundedDigitalSignals(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, boolean | number | string | null>

  const output: Record<string, boolean | number | string | null> = {}
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, MAX_DIGITAL_SIGNALS)) {
    const key = clean(rawKey, 80)
    if (!key) continue
    if (typeof rawValue === 'boolean' || rawValue === null) output[key] = rawValue
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) output[key] = rawValue
    else if (typeof rawValue === 'string') output[key] = clean(rawValue, 180)
  }
  return output
}

export function readZanotelliBridgeConfig(): ZanotelliBridgeConfig {
  return {
    enabled: Deno.env.get('ZANOTELLI_INBOUND_BRIDGE_ENABLED') === 'true',
    url: clean(Deno.env.get('ZANOTELLI_INBOUND_BRIDGE_URL'), 500),
    secret: Deno.env.get('ZANOTELLI_INBOUND_WEBHOOK_SECRET') ?? '',
  }
}

export function buildZanotelliLeadSnapshot(input: ZanotelliLeadSnapshotInput, capturedAt = new Date().toISOString()) {
  const externalLeadId = clean(input.externalLeadId, 180)
  const companyName = clean(input.companyName, 180)
  if (!externalLeadId || !companyName) throw new Error('ZANOTELLI_BRIDGE_INVALID_LEAD')

  const opportunityScore = boundedOpportunityScore(input.opportunityScore)
  const diagnostics = boundedDiagnostics(input.diagnostics)
  const digitalSignals = boundedDigitalSignals(input.digitalSignals)
  const hasAnalysis = opportunityScore !== null || diagnostics.length > 0 || Object.keys(digitalSignals).length > 0

  return {
    event_type: 'lead_snapshot' as const,
    external_lead_id: externalLeadId,
    captured_at: capturedAt,
    company_name: companyName,
    ...(clean(input.city, 120) ? { city: clean(input.city, 120) } : {}),
    ...(clean(input.businessCategory, 140) ? { business_category: clean(input.businessCategory, 140) } : {}),
    ...(clean(input.website, 300) ? { website: clean(input.website, 300) } : {}),
    ...(clean(input.publicEmail, 200) ? { public_email: clean(input.publicEmail, 200) } : {}),
    ...(clean(input.publicPhone, 40) ? { public_phone: clean(input.publicPhone, 40) } : {}),
    ...(clean(input.instagram, 180) ? { instagram: clean(input.instagram, 180) } : {}),
    source: BRIDGE_SOURCE,
    ...(clean(input.externalStatus, 80) ? { external_status: clean(input.externalStatus, 80) } : {}),
    metadata: {
      internal_prospecting: true,
      focus: INTERNAL_FOCUS,
      analysis_available: hasAnalysis,
      ...(opportunityScore !== null ? { opportunity_score: opportunityScore } : {}),
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
      ...(Object.keys(digitalSignals).length > 0 ? { digital_signals: digitalSignals } : {}),
      ...(clean(input.searchRunId, 180) ? { search_run_id: clean(input.searchRunId, 180) } : {}),
      ...(clean(input.googlePlaceId, 180) ? { google_place_id: clean(input.googlePlaceId, 180) } : {}),
    },
    idempotency_key: `lead_snapshot:${externalLeadId}`,
  }
}

async function sign(message: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function validBridgeUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function emitZanotelliLeadSnapshot(
  input: ZanotelliLeadSnapshotInput,
  config = readZanotelliBridgeConfig(),
  fetcher: typeof fetch = fetch,
): Promise<ZanotelliBridgeResult> {
  if (!config.enabled) {
    return { attempted: false, accepted: false, status: null, safeCode: 'disabled' }
  }
  if (!validBridgeUrl(config.url) || config.secret.length < 32) {
    return { attempted: false, accepted: false, status: null, safeCode: 'misconfigured' }
  }

  const payload = buildZanotelliLeadSnapshot(input)
  const raw = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = await sign(`${timestamp}.${raw}`, config.secret)

  try {
    const response = await fetcher(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-zuno-timestamp': timestamp,
        'x-zuno-signature': signature,
        'x-zuno-event-id': payload.external_lead_id,
      },
      body: raw,
      signal: AbortSignal.timeout(5000),
    })

    // Never echo arbitrary receiver text into logs. Read only a tiny bounded body
    // so the connection can be released while keeping the result sanitized.
    const responseText = (await response.text()).slice(0, MAX_RESPONSE_BYTES)
    let receiverStatus = ''
    try {
      const parsed = JSON.parse(responseText) as { status?: unknown }
      receiverStatus = typeof parsed.status === 'string' ? parsed.status : ''
    } catch {
      receiverStatus = ''
    }

    const accepted = response.status === 202 || response.status === 409
    return {
      attempted: true,
      accepted,
      status: response.status,
      safeCode: accepted ? (receiverStatus || (response.status === 409 ? 'duplicate' : 'accepted')) : `http_${response.status}`,
    }
  } catch {
    return { attempted: true, accepted: false, status: null, safeCode: 'network_error' }
  }
}
