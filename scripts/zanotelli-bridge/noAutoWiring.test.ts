import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') return []
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

describe('ZanotelliBridgeClient nunca é chamado automaticamente pelo app', () => {
  it('nenhum arquivo em src/ ou supabase/functions/ (fora deste diretório) referencia o bridge', () => {
    const offenders: string[] = []
    for (const dir of ['src', 'supabase/functions']) {
      for (const file of listFiles(resolve(process.cwd(), dir))) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
        const content = readFileSync(file, 'utf8')
        if (/zanotelli-?bridge/i.test(content) || content.includes('ZanotelliBridgeClient')) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('o fluxo de Refinar com IA (analisar-lead-ia) não importa o bridge', () => {
    const content = readFileSync(
      resolve(process.cwd(), 'supabase', 'functions', 'analisar-lead-ia', 'index.ts'),
      'utf8',
    )
    expect(content).not.toMatch(/zanotelli-?bridge/i)
  })
})
