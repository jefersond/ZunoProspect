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
const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

describe('Zanotelli internal prospecting bridge', () => {
  it('is opt-in through backend-only environment gates', () => {
    expect(helper).toContain('ZANOTELLI_INBOUND_BRIDGE_ENABLED')
    expect(helper).toContain('ZANOTELLI_INBOUND_BRIDGE_URL')
    expect(helper).toContain('ZANOTELLI_INBOUND_WEBHOOK_SECRET')
    expect(helper).toContain('Deno.env.get')
    expect(helper).not.toContain('VITE_ZANOTELLI')
  })

  it('signs every snapshot and never places the shared secret in the payload', () => {
    expect(helper).toContain("'x-zuno-timestamp': timestamp")
    expect(helper).toContain("'x-zuno-signature': signature")
    expect(helper).toContain("'x-zuno-event-id': payload.external_lead_id")
    expect(helper).toContain('sign(`${timestamp}.${raw}`, config.secret)')
    expect(helper).not.toMatch(/secret:\s*config\.secret/)
  })

  it('forces admin-owned internal email prospecting through the wrapper', () => {
    expect(endpoint).toContain("const INTERNAL_FOCUS = 'zuno_internal_prospecting'")
    expect(endpoint).toContain("const MACHINE_SCOPE = 'prospecting:execute'")
    expect(endpoint).toContain("foco: INTERNAL_FOCUS")
    expect(endpoint).toContain("canaisProspeccao: ['email']")
    expect(endpoint).toContain('Math.min(MAX_QUANTITY')
  })

  it('supports JWT users while machine calls are authenticated inside the handler', () => {
    expect(config).toMatch(/\[functions\.zanotelli-internal-prospecting\]\s*\nverify_jwt = false/)
    expect(endpoint).toContain("request.headers.get('authorization')")
    expect(endpoint).toContain("request.headers.get('x-api-key')")
    expect(endpoint).toContain("token.startsWith('zuno_')")
    expect(endpoint).toContain("scopes.includes(MACHINE_SCOPE)")
    expect(endpoint).toContain("admin.auth.admin.getUserById(userId)")
    expect(endpoint).toContain('ADMIN_EMAILS.has(email)')
  })

  it('requires idempotency and bounded rate limiting for machine searches', () => {
    expect(endpoint).toContain("request.headers.get('idempotency-key')")
    expect(endpoint).toContain('IDEMPOTENCY_PREFIX')
    expect(endpoint).toContain("from('api_idempotency_keys')")
    expect(endpoint).toContain("from('api_logs')")
    expect(endpoint).toContain('MAX_MACHINE_RPM = 5')
    expect(endpoint).toContain("error: 'idempotency_key_required'")
    expect(endpoint).toContain("error: 'idempotency_conflict'")
  })

  it('delegates only a one-request user session without storing passwords or refresh tokens', () => {
    expect(endpoint).toContain("admin.auth.admin.generateLink({")
    expect(endpoint).toContain("type: 'magiclink'")
    expect(endpoint).toContain('authClient.auth.verifyOtp({')
    expect(endpoint).toContain('token_hash: tokenHashForOtp')
    expect(endpoint).toContain('persistSession: false')
    expect(endpoint).toContain('autoRefreshToken: false')
    expect(endpoint).not.toContain('refresh_token')
    expect(endpoint).not.toContain('password:')
  })

  it('reuses the existing secure search and exact owned decrypted-lead RPC', () => {
    expect(endpoint).toContain('/functions/v1/buscar-leads')
    expect(endpoint).toContain('set_encryption_key_and_get_leads_filtered')
    expect(endpoint).toContain('p_user_id: userId')
    expect(endpoint).toContain('p_search_run_id: searchRunId')
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

  it('never forwards the machine key into the mature search or bridge payload', () => {
    expect(endpoint).toContain('authorization,')
    expect(endpoint).toContain('apikey: anonKey')
    expect(endpoint).not.toContain("'x-api-key': token")
    expect(helper).not.toContain('x-api-key')
    expect(helper).not.toContain('authorization')
  })
})