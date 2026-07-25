import { describe, expect, it } from 'vitest'
import { assertNotProduction, loadBridgeConfigFromEnv } from './env'

describe('assertNotProduction', () => {
  it('permite execução em sandbox', () => {
    expect(() => assertNotProduction({ ZANOTELLI_BRIDGE_ENVIRONMENT: 'sandbox' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('bloqueia quando VERCEL_ENV=production', () => {
    expect(() => assertNotProduction({ VERCEL_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/produção/)
  })

  it('bloqueia quando NODE_ENV=production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/produção/)
  })

  it('bloqueia quando ZANOTELLI_BRIDGE_ENVIRONMENT=production', () => {
    expect(() => assertNotProduction({ ZANOTELLI_BRIDGE_ENVIRONMENT: 'production' } as NodeJS.ProcessEnv)).toThrow(/produção/)
  })
})

describe('loadBridgeConfigFromEnv', () => {
  it('assume enabled=false e ambiente sandbox como padrão seguro quando as variáveis estão ausentes', () => {
    const config = loadBridgeConfigFromEnv({} as NodeJS.ProcessEnv)
    expect(config.enabled).toBe(false)
    expect(config.url).toBe('')
    expect(config.secret).toBe('')
    expect(config.environment).toBe('sandbox')
  })

  it('só habilita quando a variável é exatamente "true"', () => {
    expect(loadBridgeConfigFromEnv({ ZANOTELLI_BRIDGE_ENABLED: 'TRUE' } as NodeJS.ProcessEnv).enabled).toBe(false)
    expect(loadBridgeConfigFromEnv({ ZANOTELLI_BRIDGE_ENABLED: 'true' } as NodeJS.ProcessEnv).enabled).toBe(true)
  })
})
