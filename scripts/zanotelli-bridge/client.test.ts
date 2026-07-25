import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DisabledZanotelliBridgeClient,
  MockZanotelliBridgeClient,
  RealZanotelliBridgeClient,
  createZanotelliBridgeClient,
  validateBridgeUrl,
} from './client'
import { signHmacSha256 } from './security'
import { buildSandboxTechnicalEvent } from './sandboxEvent'

const SECRET = 'test-secret-only-for-unit-tests'
const CONFIG = { enabled: true, url: 'https://preview.example.invalid/api/integrations/zuno/events', secret: SECRET, environment: 'sandbox' }

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('validateBridgeUrl', () => {
  it('aceita https', () => {
    expect(() => validateBridgeUrl('https://preview.example.invalid/api')).not.toThrow()
  })

  it('rejeita http fora de localhost', () => {
    expect(() => validateBridgeUrl('http://attacker.invalid/api')).toThrow()
  })

  it('aceita http em localhost (uso local apenas)', () => {
    expect(() => validateBridgeUrl('http://localhost:3000/api')).not.toThrow()
  })

  it('rejeita uma URL malformada', () => {
    expect(() => validateBridgeUrl('não-é-uma-url')).toThrow()
  })
})

describe('DisabledZanotelliBridgeClient', () => {
  it('sempre responde bridge_disabled sem tentar rede', async () => {
    const client = new DisabledZanotelliBridgeClient()
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result).toEqual({ status: 'bridge_disabled', httpStatus: 0 })
  })
})

describe('createZanotelliBridgeClient', () => {
  it('retorna o cliente desativado quando enabled=false', () => {
    const client = createZanotelliBridgeClient({ ...CONFIG, enabled: false })
    expect(client).toBeInstanceOf(DisabledZanotelliBridgeClient)
  })

  it('exige URL quando habilitado', () => {
    expect(() => createZanotelliBridgeClient({ ...CONFIG, url: '' })).toThrow(/URL/)
  })

  it('exige segredo quando habilitado', () => {
    expect(() => createZanotelliBridgeClient({ ...CONFIG, secret: '' })).toThrow(/SECRET/)
  })
})

describe('MockZanotelliBridgeClient', () => {
  it('registra as chamadas e devolve a resposta configurada', async () => {
    const mock = new MockZanotelliBridgeClient({ status: 'duplicate', httpStatus: 409 })
    const event = buildSandboxTechnicalEvent()
    const result = await mock.sendTechnicalEvent(event)
    expect(result.status).toBe('duplicate')
    expect(mock.calls).toEqual([event])
  })
})

describe('RealZanotelliBridgeClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envia os headers exigidos com a assinatura calculada sobre o corpo exato enviado', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted', request_id: 'req-1', event_reference: 'evt-1' }, 202))
    const client = new RealZanotelliBridgeClient(CONFIG)
    const event = buildSandboxTechnicalEvent()
    const result = await client.sendTechnicalEvent(event)

    expect(result.status).toBe('accepted')
    expect(result.httpStatus).toBe(202)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe(CONFIG.url)
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('error')
    const headers = init.headers as Record<string, string>
    expect(headers['x-zuno-event-id']).toBe(event.event_id)
    expect(headers['content-type']).toBe('application/json')
    expect(typeof headers['x-zuno-timestamp']).toBe('string')
    expect(headers['x-zuno-signature']).toMatch(/^[a-f0-9]{64}$/)

    // A assinatura deve corresponder exatamente ao corpo que foi enviado —
    // nunca uma reserialização diferente do mesmo objeto.
    const rawBody = init.body as string
    expect(rawBody).toBe(JSON.stringify(event))
    const expectedSignature = await signHmacSha256(`${headers['x-zuno-timestamp']}.${rawBody}`, SECRET)
    expect(headers['x-zuno-signature']).toBe(expectedSignature)
  })

  it('nunca registra o segredo ou a assinatura em console.log', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }, 202))
    const client = new RealZanotelliBridgeClient(CONFIG)
    await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(SECRET)
    }
    logSpy.mockRestore()
  })

  it('trata resposta duplicate', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'duplicate' }, 409))
    const client = new RealZanotelliBridgeClient(CONFIG)
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result).toMatchObject({ status: 'duplicate', httpStatus: 409 })
  })

  it('trata resposta rejected', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'rejected', error: 'schema_invalid' }, 422))
    const client = new RealZanotelliBridgeClient(CONFIG)
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result).toMatchObject({ status: 'rejected', httpStatus: 422, error: 'schema_invalid' })
  })

  it('trata resposta unauthorized sem expor detalhe da assinatura esperada', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'unauthorized', error: 'invalid_signature' }, 401))
    const client = new RealZanotelliBridgeClient(CONFIG)
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result.status).toBe('unauthorized')
    expect(JSON.stringify(result)).not.toContain('expected_signature')
  })

  it('trata falha de rede como temporarily_unavailable sanitizado', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND preview.example.invalid'))
    const client = new RealZanotelliBridgeClient(CONFIG)
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result.status).toBe('temporarily_unavailable')
    expect(result.error).toBe('network_error')
  })

  it('aplica timeout e não trava esperando uma resposta que nunca chega', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const client = new RealZanotelliBridgeClient({ ...CONFIG, timeoutMs: 20 })
    const result = await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(result.status).toBe('temporarily_unavailable')
    expect(result.error).toBe('timeout')
  })

  it('não tenta novamente automaticamente após uma falha', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const client = new RealZanotelliBridgeClient(CONFIG)
    await client.sendTechnicalEvent(buildSandboxTechnicalEvent())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
