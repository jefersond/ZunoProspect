import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const machine = readFileSync(
  resolve(process.cwd(), 'supabase/functions/zanotelli-machine-prospecting/index.ts'),
  'utf8',
)

describe('Zanotelli Zuno email-only discovery', () => {
  it('uses Zuno as the primary source and never calls Hunter', () => {
    expect(machine).toContain("canaisProspeccao: ['email']")
    expect(machine).toContain('/functions/v1/buscar-leads')
    expect(machine).toContain('nativeEmailOnly: true')
    expect(machine).not.toContain('api.hunter.io')
  })

  it('re-reads the authoritative encrypted search run before filtering email', () => {
    expect(machine).toContain("set_encryption_key_and_get_leads_filtered")
    expect(machine).toContain('p_search_run_id: searchRunId')
    expect(machine).not.toContain('const responseRows =')
  })

  it('checks bounded same-origin contact pages when the homepage has no email', () => {
    expect(machine).toContain('MAX_CRAWL_PAGES_PER_SITE = 3')
    expect(machine).toContain("'/contato'")
    expect(machine).toContain("'/contact'")
    expect(machine).toContain("'/fale-conosco'")
    expect(machine).toContain("'/sobre'")
    expect(machine).toContain('candidate.origin !== baseUrl.origin')
    expect(machine).toContain('parsed.origin !== website.origin')
  })

  it('keeps crawling bounded and rejects local/private URL targets', () => {
    expect(machine).toContain('MAX_HTML_BYTES = 512 * 1024')
    expect(machine).toContain('PAGE_FETCH_TIMEOUT_MS = 3500')
    expect(machine).toContain("host === 'localhost'")
    expect(machine).toContain("192\\.168\\.")
    expect(machine).toContain("169\\.254\\.")
  })

  it('does not arm or send outbound while discovering email', () => {
    expect(machine).toContain('outboundArmed: false')
    expect(machine).toContain('emailSent: 0')
    expect(machine).toContain('whatsappSent: 0')
  })
})
