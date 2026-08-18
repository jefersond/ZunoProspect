import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818141000_zanotelli_lead_context_lookup.sql'),
  'utf8',
);
const endpoint = readFileSync(
  resolve(process.cwd(), 'supabase/functions/zanotelli-lead-context-lookup/index.ts'),
  'utf8',
);
const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

describe('Zanotelli lead context bridge', () => {
  it('restringe lookup aos usuários explicitamente autorizados', () => {
    expect(migration).toContain('zanotelli_context_scope_users');
    expect(migration).toContain('scope.active = true');
    expect(migration).toContain('scope.user_id = lead.user_id');
    expect(migration).toContain('revoke all on function public.internal_lookup_zanotelli_lead_context(text)');
    expect(migration).toContain('grant execute on function public.internal_lookup_zanotelli_lead_context(text) to service_role');
  });

  it('usa hash de telefone e não devolve os campos de contato no contexto', () => {
    expect(migration).toContain("'zanotelli-phone:v1:'");
    expect(migration).toContain("'company'");
    expect(migration).toContain("'digital_signals'");
    expect(migration).toContain("'commercial_intelligence'");
    expect(migration).not.toContain("'email', lead_row");
    expect(migration).not.toContain("'phone', lead_row");
    expect(migration).not.toContain("'address', lead_row");
    expect(migration).not.toContain("'cnpj', lead_row");
  });

  it('protege o endpoint com HMAC e janela antireplay', () => {
    expect(endpoint).toContain('x-zanotelli-timestamp');
    expect(endpoint).toContain('x-zanotelli-signature');
    expect(endpoint).toContain('crypto.subtle.verify');
    expect(endpoint).toContain('MAX_CLOCK_SKEW_SECONDS = 300');
    expect(endpoint).toContain('internal_zanotelli_context_bridge_secret');
    expect(config).toContain('[functions.zanotelli-lead-context-lookup]\nverify_jwt = false');
  });
});
