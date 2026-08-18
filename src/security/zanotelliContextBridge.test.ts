import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818141000_zanotelli_lead_context_lookup.sql'),
  'utf8',
);
const identityMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818162220_zanotelli_identity_resolution_v2.sql'),
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
    expect(identityMigration).toContain('scope.active = true');
    expect(identityMigration).toContain('scope.user_id = lead.user_id');
    expect(identityMigration).toContain('revoke all on function public.internal_lookup_zanotelli_lead_context_v2');
    expect(identityMigration).toContain('grant execute on function public.internal_lookup_zanotelli_lead_context_v2');
  });

  it('usa hashes de identidade e não devolve campos de contato no contexto', () => {
    expect(migration).toContain("'zanotelli-phone:v1:'");
    expect(identityMigration).toContain("'zanotelli-email:v1:'");
    expect(identityMigration).toContain("'zanotelli-domain:v1:'");
    expect(identityMigration).toContain("'zanotelli-company:v1:'");
    expect(identityMigration).toContain("'zanotelli-responsible:v1:'");
    expect(identityMigration).toContain("'company'");
    expect(identityMigration).toContain("'digital_signals'");
    expect(identityMigration).toContain("'commercial_intelligence'");
    expect(identityMigration).not.toContain("'email', lead_row");
    expect(identityMigration).not.toContain("'phone', lead_row");
    expect(identityMigration).not.toContain("'address', lead_row");
    expect(identityMigration).not.toContain("'cnpj', lead_row");
  });

  it('resolve em cascata por referência, telefone, email, domínio e empresa sem fuzzy auto-bind', () => {
    expect(identityMigration).toContain("matched_by := 'lead_reference'");
    expect(identityMigration).toContain("matched_by := 'phone'");
    expect(identityMigration).toContain("matched_by := 'email'");
    expect(identityMigration).toContain("matched_by := 'domain'");
    expect(identityMigration).toContain("matched_by := 'company_responsible'");
    expect(identityMigration).toContain("matched_by := 'company'");
    expect(identityMigration).toContain("'status','ambiguous'");
    expect(identityMigration).not.toContain('similarity(');
    expect(identityMigration).not.toContain('levenshtein');
  });

  it('protege o endpoint com HMAC, janela antireplay e rejeição de propriedades desconhecidas', () => {
    expect(endpoint).toContain('x-zanotelli-timestamp');
    expect(endpoint).toContain('x-zanotelli-signature');
    expect(endpoint).toContain('crypto.subtle.verify');
    expect(endpoint).toContain('MAX_CLOCK_SKEW_SECONDS = 300');
    expect(endpoint).toContain('ALLOWED_KEYS');
    expect(endpoint).toContain('internal_zanotelli_context_bridge_secret');
    expect(endpoint).toContain('internal_lookup_zanotelli_lead_context_v2');
    expect(config).toContain('[functions.zanotelli-lead-context-lookup]\nverify_jwt = false');
  });
});
