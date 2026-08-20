import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(
  resolve(process.cwd(), 'supabase/functions/zanotelli-machine-prospecting/index.ts'),
  'utf8',
)
const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

describe('Zanotelli machine prospecting endpoint', () => {
  it('is machine-only and rejects browser use', () => {
    expect(config).toMatch(/\[functions\.zanotelli-machine-prospecting\]\s*\nverify_jwt = false/)
    expect(endpoint).toContain("request.headers.has('origin')")
    expect(endpoint).toContain("request.headers.get('x-api-key')")
    expect(endpoint).toContain('API_KEY_PATTERN')
    expect(endpoint).not.toContain("request.headers.get('authorization')")
  })

  it('allows exactly one scope and exact internal ADM identity', () => {
    expect(endpoint).toContain("const MACHINE_SCOPE = 'prospecting:execute'")
    expect(endpoint).toContain("scopes.some((scope) => scope !== MACHINE_SCOPE)")
    expect(endpoint).toContain("ADMIN_USER_ID = '293cbcc2-1262-4e22-845c-8178ca1dddff'")
    expect(endpoint).toContain("ADMIN_EMAIL = 'jeferson.zanotell@gmail.com'")
    expect(endpoint).toContain("admin.rpc('is_admin'")
  })

  it('caps each search at five leads and forces internal email prospecting', () => {
    expect(endpoint).toContain('const MAX_QUANTITY = 5')
    expect(endpoint).toContain("foco: INTERNAL_FOCUS")
    expect(endpoint).toContain("canaisProspeccao: ['email']")
    expect(endpoint).toContain("const INTERNAL_FOCUS = 'zuno_internal_prospecting'")
  })

  it('requires idempotency and low rate limits before paid search', () => {
    expect(endpoint).toContain('const MAX_MACHINE_RPM = 2')
    expect(endpoint).toContain("request.headers.get('idempotency-key')")
    expect(endpoint).toContain("from('api_idempotency_keys')")
    expect(endpoint).toContain("from('api_logs')")
    expect(endpoint).toContain("'x-idempotency-replayed': 'true'")
  })

  it('keeps the mature search JWT-only by using a one-request delegated session', () => {
    expect(endpoint).toContain("admin.auth.admin.generateLink({")
    expect(endpoint).toContain("type: 'magiclink'")
    expect(endpoint).toContain('authClient.auth.verifyOtp({')
    expect(endpoint).toContain('persistSession: false')
    expect(endpoint).toContain('autoRefreshToken: false')
    expect(endpoint).toContain('/functions/v1/buscar-leads')
    expect(endpoint).not.toContain('password:')
    expect(endpoint).not.toContain('refresh_token')
  })

  it('derives the inbound signing secret from the machine key without persisting it in Zuno', () => {
    expect(endpoint).toContain("sha256(`zanotelli-inbound-hmac:v1:${auth.token}`)")
    expect(endpoint).toContain("url: RECEIVER_URL")
    expect(endpoint).toContain('secret: signingSecret')
    expect(endpoint).not.toContain('ZANOTELLI_INBOUND_WEBHOOK_SECRET')
  })

  it('pins the receiver and never sends email or WhatsApp itself', () => {
    expect(endpoint).toContain("RECEIVER_URL = 'https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/zuno-inbound-bridge'")
    expect(endpoint).toContain('outboundArmed: false')
    expect(endpoint).toContain('emailSent: 0')
    expect(endpoint).toContain('whatsappSent: 0')
    expect(endpoint).not.toContain('api.instantly.ai')
    expect(endpoint).not.toContain('graph.facebook.com')
    expect(endpoint).not.toContain('wa.me')
  })
})