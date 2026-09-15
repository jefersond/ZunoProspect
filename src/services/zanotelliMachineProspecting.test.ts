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

  it('bridges only leads that already have a valid public email', () => {
    expect(source).toContain('function validPublicEmail')
    expect(source).toContain('candidateRows.filter((row) => Boolean(validPublicEmail(row))).slice(0, quantidade)')
    expect(source).toContain("safeCode: 'invalid_email_lead'")
    expect(source).toContain('nativeEmailOnly: true')
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
