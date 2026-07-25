import type { ZanotelliBridgeConfig } from './types'

/** Lança se qualquer sinal de ambiente de produção for detectado. */
export function assertNotProduction(env: NodeJS.ProcessEnv = process.env): void {
  const productionSignals = [
    env.VERCEL_ENV === 'production',
    env.NODE_ENV === 'production',
    env.ZANOTELLI_BRIDGE_ENVIRONMENT === 'production',
  ]
  if (productionSignals.some(Boolean)) {
    throw new Error('Execução bloqueada: ambiente de produção detectado.')
  }
}

export function loadBridgeConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ZanotelliBridgeConfig {
  return {
    enabled: env.ZANOTELLI_BRIDGE_ENABLED === 'true',
    url: env.ZANOTELLI_BRIDGE_URL ?? '',
    secret: env.ZANOTELLI_BRIDGE_SECRET ?? '',
    environment: env.ZANOTELLI_BRIDGE_ENVIRONMENT ?? 'sandbox',
  }
}
