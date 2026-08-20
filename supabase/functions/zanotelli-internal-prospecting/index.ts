import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emitZanotelliLeadSnapshot } from '../_shared/zanotelli-inbound-bridge.ts'

const INTERNAL_FOCUS = 'zuno_internal_prospecting'
const MAX_QUANTITY = 25
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

serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'json_required' }, 415)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY') ?? ''
  const authorization = request.headers.get('authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRole || !encryptionKey || !authorization) {
    return json({ error: 'server_misconfigured' }, 503)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRole, {
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

  let input: Record<string, unknown>
  try {
    const parsed = await request.json() as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_payload' }, 400)
    input = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const quantity = Math.max(1, Math.min(MAX_QUANTITY, Number(input.quantidade) || 5))
  const searchPayload = {
    ...input,
    quantidade: quantity,
    foco: INTERNAL_FOCUS,
    canaisProspeccao: ['email'],
  }

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

  const { data: leads, error: leadsError } = await admin.rpc('set_encryption_key_and_get_leads_filtered', {
    p_encryption_key: encryptionKey,
    p_salvo: null,
    p_user_id: user.id,
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

  return json({
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
  }, 200)
})