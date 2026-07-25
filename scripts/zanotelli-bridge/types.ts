// Tipos do ZunoInboundBridge (contrato do Zanotelli OS). Espelha exatamente
// o schema já confirmado e documentado em
// docs/integrations/zuno-inbound-bridge.md do repositório zanotelli-os —
// não inventa nem amplia o contrato.

export interface TechnicalEventPayload {
  event_type: 'technical_event'
  event_id: string
  occurred_at: string
  source: string
  environment?: string
  feature?: string
  /** O contrato real só aceita estes quatro valores — não existe "warning". */
  severity?: 'low' | 'medium' | 'high' | 'critical'
  error_code?: string
  safe_message?: string
  /** Deve ser omitido (undefined), nunca `null` — o contrato trata `null` como valor inválido. */
  anonymous_user_reference?: string
  metadata?: Record<string, unknown>
  idempotency_key: string
}

export type BridgeResponseStatus =
  | 'accepted'
  | 'duplicate'
  | 'rejected'
  | 'bridge_disabled'
  | 'invalid_request'
  | 'unauthorized'
  | 'temporarily_unavailable'

export interface BridgeResponse {
  status: BridgeResponseStatus
  httpStatus: number
  requestId?: string
  eventReference?: string
  error?: string
}

export interface ZanotelliBridgeConfig {
  enabled: boolean
  url: string
  secret: string
  environment: string
  timeoutMs?: number
}

export interface ZanotelliBridgeClient {
  sendTechnicalEvent(payload: TechnicalEventPayload): Promise<BridgeResponse>
}
