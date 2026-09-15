import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/zanotelli-machine-prospecting/index.ts'),
  'utf8',
)

describe('Zanotelli machine prospecting supplier', () => {
  it('uses the native Zuno email channel and scans a larger bounded pool', () => {
    expect(source).toContain("canaisProspeccao: ['email']")
    expect(source).toContain('const MAX_SEARCH_QUANTITY = 25')
    expect(source).toContain('quantidade * 5')
  })

  it('bridges only leads with a valid public email found by Zuno or the bounded site crawler', () => {
    expect(source).toContain('function validPublicEmail')
    expect(source).toContain('discoverPublicEmail(row)')
    expect(source).toContain('rows.push({ ...row, email: discovery.email })')
    expect(source).toContain("safeCode: 'invalid_email_lead'")
    expect(source).toContain('nativeEmailOnly: true')
  })

  it('re-reads the authoritative encrypted run instead of trusting the reduced public response', () => {
    expect(source).toContain("set_encryption_key_and_get_leads_filtered")
    expect(source).toContain('p_search_run_id: searchRunId')
    expect(source).not.toContain('const responseRows =')
  })

  it('does not use Hunter or arm/send outbound', () => {
    expect(source).not.toContain('api.hunter.io')
    expect(source).not.toContain('hunter-lead-enrichment')
    expect(source).toContain('outboundArmed: false')
    expect(source).toContain('emailSent: 0')
    expect(source).toContain('whatsappSent: 0')
  })

  it('keeps the machine endpoint private, scoped and idempotent', () => {
    expect(source).toContain("const MACHINE_SCOPE = 'prospecting:execute'")
    expect(source).toContain("request.headers.get('x-api-key')")
    expect(source).toContain("request.headers.get('idempotency-key')")
    expect(source).toContain("if (request.headers.has('origin'))")
  })
})
