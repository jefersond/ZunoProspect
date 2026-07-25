import type { TechnicalEventPayload } from './types'

/**
 * Evento técnico de sandbox para validar a ponte manualmente. Nunca contém
 * nome, e-mail, telefone, dado de lead, prompt, resposta de IA, stack trace
 * real, senha, token, cookie, chave ou ID real de usuário.
 *
 * O pedido original especificava `severity: "warning"` e
 * `anonymous_user_reference: null`. Nenhum dos dois é aceito pelo contrato
 * real do ZunoInboundBridge (severidade só aceita
 * low/medium/high/critical; o campo opcional deve ser omitido, não `null`
 * — um `null` explícito falha a validação de schema e o evento seria
 * marcado como `rejected`). Por isso: `severity` mapeia para `"medium"`
 * (o mais próximo de um aviso não crítico) e o campo de referência de
 * usuário é omitido inteiramente.
 */
export function buildSandboxTechnicalEvent(): TechnicalEventPayload {
  const eventId = crypto.randomUUID()
  return {
    event_type: 'technical_event',
    event_id: eventId,
    occurred_at: new Date().toISOString(),
    source: 'zuno-prospect',
    environment: 'sandbox',
    feature: 'refine_with_ai',
    severity: 'medium',
    error_code: 'SANDBOX_CONNECTION_TEST',
    safe_message: 'Evento técnico simulado para validar a integração com o Zanotelli OS.',
    metadata: {
      simulated: true,
      origin: 'manual_test',
      contains_real_user_data: false,
    },
    idempotency_key: crypto.randomUUID(),
  }
}
