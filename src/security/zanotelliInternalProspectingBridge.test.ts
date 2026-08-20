import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const helper = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/zanotelli-inbound-bridge.ts'),
  'utf8',
)
const endpoint = readFileSync(
  resolve(process.cwd(), 'supabase/functions/zanotelli-internal-prospecting/index.ts'),
  'utf8',
)

describe('Zanotelli internal prospecting bridge', () => {
  it('is opt-in through backend-only environment gates', () => {
    expect(helper).toContain("ZANOTELLI_INBOUND_BRIDGE_ENABLED")
    expect(helper).toContain("ZANOTELLI_INBOUND_BRIDGE_URL")
    expect(helper).toContain("ZANOTELLI_INBOUND_WEBHOOK_SECRET")
    expect(helper).toContain("Deno.env.get")
    expect(helper).not.toContain('VITE_ZANOTELLI')
  })

  it('signs every snapshot and never places the shared secret in the payload', () => {
    expect(helper).toContain("'x-zuno-timestamp': timestamp")
    expect(helper).toContain("'x-zuno-signature': signature")
    expect(helper).toContain("'x-zuno-event-id': payload.external_lead_id")
    expect(helper).toContain('sign(`${timestamp}.${raw}`, config.secret)')
    expect(helper).not.toMatch(/secret:\s*config\.secret/)
  })

  it('accepts only admin-owned internal prospecting through the wrapper', () => {
    expect(endpoint).toContain("const INTERNAL_FOCUS = 'zuno_internal_prospecting'")
    expect(endpoint).toContain("if (!ADMIN_EMAILS.has(normalizedEmail) && adminCheck !== true)")
    expect(endpoint).toContain("foco: INTERNAL_FOCUS")
    expect(endpoint).toContain("canaisProspeccao: ['email']")
  })

  it('supports a signed non-browser machine path without storing a password or long-lived user JWT', () => {
    expect(endpoint).toContain("ZANOTELLI_MACHINE_PROSPECTING_SECRET")
    expect(endpoint).toContain("ZANOTELLI_MACHINE_ADMIN_EMAIL")
    expect(endpoint).toContain("x-zanotelli-timestamp")
    expect(endpoint).toContain("x-zanotelli-signature")
    expect(endpoint).toContain('MACHINE_REPLAY_WINDOW_SECONDS = 300')
    expect(endpoint).toContain('MAX_MACHINE_QUANTITY = 5')
    expect(endpoint).toContain("admin.auth.admin.generateLink")
    expect(endpoint).toContain("type: 'magiclink'")
    expect(endpoint).toContain('sessionClient.auth.verifyOtp')
    expect(endpoint).toContain('request.headers.has(\'origin\')')
    expect(endpoint).not.toMatch(/password\s*:/i)
    expect(endpoint).not.toContain('MACHINE_USER_JWT')
  })

  it('never returns or persists the generated machine user session', () => {
    expect(endpoint).toContain('authorization = `Bearer ${accessToken}`')
    expect(endpoint).toContain('authMode,')
    expect(endpoint).not.toMatch(/accessToken\s*[,}]/)
    expect(endpoint).not.toMatch(/refresh_token/i)
  })

  it('reuses the existing secure search, analysis and owned decrypted-lead RPC', () => {
    expect(endpoint).toContain('/functions/v1/buscar-leads')
    expect(endpoint).toContain('/functions/v1/analisar-lead-ia')
    expect(endpoint).toContain('const MAX_OPPORTUNITY_ANALYSES = 5')
    expect(endpoint).toContain("set_encryption_key_and_get_leads_filtered")
    expect(endpoint).toContain('p_user_id: user.id')
    expect(endpoint).toContain('p_search_run_id: searchRunId')
  })

  it('exports bounded opportunity intelligence as prioritization metadata', () => {
    expect(endpoint).toContain('opportunityScore: opportunityScore(row.probabilidade_conversao)')
    expect(endpoint).toContain('diagnostics: row.diagnostico_bullets')
    expect(endpoint).toContain('digitalSignals: row.sinais_digitais')
    expect(helper).toContain('opportunity_score: opportunityScore')
    expect(helper).toContain('analysis_available: hasAnalysis')
    expect(helper).toContain('focus: INTERNAL_FOCUS')
    expect(helper).toContain('MAX_DIAGNOSTICS = 4')
    expect(helper).toContain('MAX_DIGITAL_SIGNALS = 16')
  })

  it('does not turn opportunity analysis into contact authorization', () => {
    expect(helper).not.toContain('contact_allowed')
    expect(helper).not.toContain('email_contact_allowed')
    expect(endpoint).not.toContain('contact_allowed')
    expect(endpoint).not.toContain('email_contact_allowed')
  })

  it('does not arm outbound or send email/WhatsApp', () => {
    expect(endpoint).toContain('outboundArmed: false')
    expect(endpoint).toContain('emailSent: 0')
    expect(endpoint).toContain('whatsappSent: 0')
    expect(endpoint).not.toContain('api.instantly.ai')
    expect(endpoint).not.toContain('graph.facebook.com')
    expect(endpoint).not.toContain('wa.me')
  })

  it('uses stable per-lead idempotency and bounded public fields', () => {
    expect(helper).toContain('idempotency_key: `lead_snapshot:${externalLeadId}`')
    expect(helper).toContain('company_name: companyName')
    expect(helper).toContain('public_email')
    expect(helper).toContain('public_phone')
    expect(helper).toContain('internal_prospecting: true')
  })
})
