// ZanotelliBridgeClient — único ponto de saída HTTP para o ZunoInboundBridge.
// Isolado de propósito: nenhum outro módulo da Zuno deve chamar o Zanotelli
// OS diretamente. Esta etapa só é usada pelo disparo manual de sandbox
// (scripts/zanotelli-bridge-test.mjs) — nunca pelo fluxo real de "Refinar
// com IA", busca, cadastro, login ou tratamento global de erros.
import { maskIdentifier, signHmacSha256 } from './security'
import type {
  BridgeResponse,
  BridgeResponseStatus,
  TechnicalEventPayload,
  ZanotelliBridgeClient as ZanotelliBridgeClientInterface,
  ZanotelliBridgeConfig,
} from './types'

const DEFAULT_TIMEOUT_MS = 8000
const KNOWN_STATUSES: BridgeResponseStatus[] = [
  'accepted', 'duplicate', 'rejected', 'bridge_disabled',
  'invalid_request', 'unauthorized', 'temporarily_unavailable',
]

function isKnownStatus(value: unknown): value is BridgeResponseStatus {
  return typeof value === 'string' && (KNOWN_STATUSES as string[]).includes(value)
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/** Valida a URL configurada. Nunca aceita uma URL vinda de entrada do usuário. */
export function validateBridgeUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('ZANOTELLI_BRIDGE_URL inválida.')
  }
  if (url.protocol !== 'https:' && !isLocalHostname(url.hostname)) {
    throw new Error('ZANOTELLI_BRIDGE_URL deve usar https:// fora de ambiente local.')
  }
  return url
}

export class RealZanotelliBridgeClient implements ZanotelliBridgeClientInterface {
  private readonly url: URL
  private readonly secret: string
  private readonly timeoutMs: number

  constructor(config: ZanotelliBridgeConfig) {
    if (!config.enabled) throw new Error('ZanotelliBridgeClient: integração desativada.')
    if (!config.url) throw new Error('ZANOTELLI_BRIDGE_URL ausente.')
    if (!config.secret) throw new Error('ZANOTELLI_BRIDGE_SECRET ausente.')
    this.url = validateBridgeUrl(config.url)
    this.secret = config.secret
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async sendTechnicalEvent(payload: TechnicalEventPayload): Promise<BridgeResponse> {
    const timestampSeconds = Math.floor(Date.now() / 1000)
    // Serializado exatamente uma vez: a mesma string assina e é enviada.
    const rawBody = JSON.stringify(payload)
    const signature = await signHmacSha256(`${timestampSeconds}.${rawBody}`, this.secret)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        redirect: 'error', // nunca seguir redirecionamento para outro domínio
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-zuno-timestamp': String(timestampSeconds),
          'x-zuno-signature': signature,
          'x-zuno-event-id': payload.event_id,
        },
        body: rawBody,
      })

      let json: unknown = null
      try {
        json = await response.json()
      } catch {
        json = null
      }
      const body = (json ?? {}) as Record<string, unknown>
      const status = isKnownStatus(body.status) ? body.status : 'temporarily_unavailable'

      return {
        status,
        httpStatus: response.status,
        requestId: typeof body.request_id === 'string' ? body.request_id : undefined,
        eventReference: typeof body.event_reference === 'string' ? body.event_reference : undefined,
        error: typeof body.error === 'string' ? body.error : undefined,
      }
    } catch (cause) {
      const aborted = controller.signal.aborted
      return {
        status: 'temporarily_unavailable',
        httpStatus: 0,
        error: aborted ? 'timeout' : 'network_error',
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export class DisabledZanotelliBridgeClient implements ZanotelliBridgeClientInterface {
  async sendTechnicalEvent(_payload: TechnicalEventPayload): Promise<BridgeResponse> {
    return { status: 'bridge_disabled', httpStatus: 0 }
  }
}

export class MockZanotelliBridgeClient implements ZanotelliBridgeClientInterface {
  public readonly calls: TechnicalEventPayload[] = []
  constructor(private readonly response: BridgeResponse = { status: 'accepted', httpStatus: 202 }) {}

  async sendTechnicalEvent(payload: TechnicalEventPayload): Promise<BridgeResponse> {
    this.calls.push(payload)
    return this.response
  }
}

export function createZanotelliBridgeClient(config: ZanotelliBridgeConfig): ZanotelliBridgeClientInterface {
  if (!config.enabled) return new DisabledZanotelliBridgeClient()
  return new RealZanotelliBridgeClient(config)
}

export { maskIdentifier }
