const BRIDGE_SOURCE = 'zuno-prospect-internal'
const MAX_RESPONSE_BYTES = 8 * 1024

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
}

export interface ZanotelliRevenueEventInput {
  eventId: string
  email: string
  planId?: string | null
  amount?: number | null
  currency?: string | null
  occurredAt?: string | null
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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
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

export async function emitZanotelliRevenueEvent(
  input: ZanotelliRevenueEventInput,
  config = readZanotelliBridgeConfig(),
  fetcher: typeof fetch = fetch,
): Promise<ZanotelliBridgeResult> {
  if (!config.enabled) {
    return { attempted: false, accepted: false, status: null, safeCode: 'disabled' }
  }
  if (!validBridgeUrl(config.url) || config.secret.length < 32) {
    return { attempted: false, accepted: false, status: null, safeCode: 'misconfigured' }
  }

  const eventId = clean(input.eventId, 120)
  const normalizedEmail = clean(input.email, 254).toLowerCase()
  const planId = clean(input.planId, 20).toLowerCase()
  const currency = (clean(input.currency, 3) || 'BRL').toUpperCase()
  const occurredAt = clean(input.occurredAt, 40) || new Date().toISOString()
  const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) && input.amount >= 0
    ? Math.min(input.amount, 10_000_000)
    : undefined

  if (!eventId || !normalizedEmail || !normalizedEmail.includes('@')) {
    return { attempted: false, accepted: false, status: null, safeCode: 'invalid_revenue_event' }
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { attempted: false, accepted: false, status: null, safeCode: 'invalid_currency' }
  }
  if (planId && !['starter','pro','agency','agencia'].includes(planId)) {
    return { attempted: false, accepted: false, status: null, safeCode: 'invalid_plan' }
  }

  const emailHash = await sha256Hex(normalizedEmail)
  const payload = {
    event_type: 'revenue_event' as const,
    event_id: eventId,
    occurred_at: occurredAt,
    source: 'zuno-stripe',
    email_hash: emailHash,
    ...(planId ? { plan_id: planId } : {}),
    ...(amount !== undefined ? { amount } : {}),
    currency,
    status: 'paid' as const,
    idempotency_key: `revenue:${eventId}`,
  }

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
        'x-zuno-event-id': eventId,
      },
      body: raw,
      signal: AbortSignal.timeout(5000),
    })

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



export type ZanotelliProductEventName =
  | 'card_added'
  | 'trial_started'
  | 'onboarding_started'
  | 'first_search'
  | 'first_results'
  | 'first_lead_opened'
  | 'first_value_reached'
  | 'returned_during_trial'
  | 'trial_converted_to_paid'
  | 'trial_cancelled'
  | 'subscription_cancelled'
  | 'payment_failed'

export interface ZanotelliProductEventInput {
  eventName: ZanotelliProductEventName
  eventId: string
  userId: string
  occurredAt?: string | null
  planId?: string | null
  trialEnd?: string | null
  searchRunId?: string | null
  returnedQuantity?: number | null
}

export async function emitZanotelliProductEvent(
  input: ZanotelliProductEventInput,
  config = readZanotelliBridgeConfig(),
  fetcher: typeof fetch = fetch,
): Promise<ZanotelliBridgeResult> {
  if (!config.enabled) {
    return { attempted: false, accepted: false, status: null, safeCode: 'disabled' }
  }
  if (!validBridgeUrl(config.url) || config.secret.length < 32) {
    return { attempted: false, accepted: false, status: null, safeCode: 'misconfigured' }
  }

  const rawUserId = clean(input.userId, 120)
  const rawEventId = clean(input.eventId, 180)
  if (!rawUserId || !rawEventId) {
    return { attempted: false, accepted: false, status: null, safeCode: 'invalid_product_event' }
  }

  const [userHash, eventHash] = await Promise.all([
    sha256Hex(rawUserId),
    sha256Hex(rawEventId),
  ])
  const occurredAt = clean(input.occurredAt, 40) || new Date().toISOString()
  const planId = clean(input.planId, 20).toLowerCase()
  const trialEnd = clean(input.trialEnd, 40)
  const searchRunId = clean(input.searchRunId, 180)
  const returnedQuantity = typeof input.returnedQuantity === 'number' && Number.isFinite(input.returnedQuantity)
    ? Math.max(0, Math.floor(input.returnedQuantity))
    : undefined

  const eventReference = `zuno-${input.eventName}-${eventHash.slice(0, 24)}`
  const payload = {
    event_type: 'technical_event' as const,
    event_id: eventReference,
    occurred_at: occurredAt,
    source: 'zuno-product',
    environment: 'production',
    feature: 'trial_activation',
    severity: 'info',
    safe_message: input.eventName,
    anonymous_user_reference: userHash.slice(0, 32),
    metadata: {
      product_event_name: input.eventName,
      ...(planId ? { plan_id: planId } : {}),
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      ...(searchRunId ? { search_run_id: searchRunId } : {}),
      ...(returnedQuantity !== undefined ? { returned_quantity: returnedQuantity } : {}),
    },
    idempotency_key: `product:${eventHash}`,
  }

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
        'x-zuno-event-id': payload.event_id,
      },
      body: raw,
      signal: AbortSignal.timeout(5000),
    })

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
