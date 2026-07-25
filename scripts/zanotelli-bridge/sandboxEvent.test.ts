import { describe, expect, it } from 'vitest'
import { buildSandboxTechnicalEvent } from './sandboxEvent'

const FORBIDDEN_KEYS = [
  'email', 'phone', 'telefone', 'name', 'nome', 'password', 'senha',
  'token', 'cookie', 'api_key', 'apikey', 'secret', 'authorization',
  'stack', 'lead_id', 'user_id', 'prompt', 'response',
]

describe('buildSandboxTechnicalEvent', () => {
  it('monta um payload correto e compatível com o contrato real', () => {
    const event = buildSandboxTechnicalEvent()
    expect(event.event_type).toBe('technical_event')
    expect(event.source).toBe('zuno-prospect')
    expect(event.environment).toBe('sandbox')
    expect(event.feature).toBe('refine_with_ai')
    expect(event.error_code).toBe('SANDBOX_CONNECTION_TEST')
    expect(event.metadata).toMatchObject({
      simulated: true,
      origin: 'manual_test',
      contains_real_user_data: false,
    })
  })

  it('usa uma severidade aceita pelo contrato real (nunca "warning")', () => {
    const event = buildSandboxTechnicalEvent()
    expect(['low', 'medium', 'high', 'critical']).toContain(event.severity)
  })

  it('omite anonymous_user_reference em vez de enviar null', () => {
    const event = buildSandboxTechnicalEvent()
    expect(event.anonymous_user_reference).toBeUndefined()
    expect('anonymous_user_reference' in event ? JSON.stringify(event).includes('"anonymous_user_reference":null') : false).toBe(false)
  })

  it('gera um event_id e um idempotency_key válidos e diferentes entre si', () => {
    const event = buildSandboxTechnicalEvent()
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(event.event_id).toMatch(uuidPattern)
    expect(event.idempotency_key).toMatch(uuidPattern)
    expect(event.event_id).not.toBe(event.idempotency_key)
  })

  it('gera identificadores novos a cada chamada', () => {
    const a = buildSandboxTechnicalEvent()
    const b = buildSandboxTechnicalEvent()
    expect(a.event_id).not.toBe(b.event_id)
    expect(a.idempotency_key).not.toBe(b.idempotency_key)
  })

  it('nunca contém dados pessoais ou segredos em nenhum campo', () => {
    const serialized = JSON.stringify(buildSandboxTechnicalEvent()).toLowerCase()
    for (const key of FORBIDDEN_KEYS) {
      expect(serialized).not.toContain(`"${key}"`)
    }
  })

  it('occurred_at é uma data ISO 8601 válida e recente', () => {
    const event = buildSandboxTechnicalEvent()
    const parsed = Date.parse(event.occurred_at)
    expect(Number.isFinite(parsed)).toBe(true)
    expect(Math.abs(Date.now() - parsed)).toBeLessThan(5000)
  })
})
