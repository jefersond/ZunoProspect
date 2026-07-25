import { describe, expect, it } from 'vitest'
import { maskIdentifier, signHmacSha256 } from './security'

describe('signHmacSha256', () => {
  it('produz uma assinatura hexadecimal de 64 caracteres (SHA-256)', async () => {
    const signature = await signHmacSha256('1700000000.{"a":1}', 'segredo-de-teste')
    expect(signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('é determinística para a mesma mensagem e segredo', async () => {
    const a = await signHmacSha256('msg', 'segredo')
    const b = await signHmacSha256('msg', 'segredo')
    expect(a).toBe(b)
  })

  it('muda quando o segredo muda', async () => {
    const a = await signHmacSha256('msg', 'segredo-a')
    const b = await signHmacSha256('msg', 'segredo-b')
    expect(a).not.toBe(b)
  })
})

describe('maskIdentifier', () => {
  it('mascara um UUID mantendo só as pontas', () => {
    expect(maskIdentifier('11111111-2222-3333-4444-555555555555')).toBe('1111…5555')
  })

  it('mascara totalmente valores curtos', () => {
    expect(maskIdentifier('abc')).toBe('***')
  })
})
