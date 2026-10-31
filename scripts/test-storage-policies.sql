DO $$
DECLARE
  v_non_admin_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
  v_admin_id uuid := 'dbfecd10-d70b-464a-86f1-2ff178496db0'::uuid;
BEGIN
  -- 1. Garante usuário comum em auth.users
  INSERT INTO auth.users (id, email)
  VALUES (v_non_admin_id, 'test_storage_non_admin@local.test')
  ON CONFLICT (id) DO UPDATE SET email = 'test_storage_non_admin@local.test';

  INSERT INTO public.profiles (id, nome_completo)
  VALUES (v_non_admin_id, 'User Storage Comum')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Garante perfil e role admin para o admin oficial
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (v_admin_id, 'Admin Jeferson')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;
END $$;

-- Teste 1: Usuário comum tentando fazer INSERT em storage.objects no bucket instagram-assets
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-2222-3333-4444-555555555555', true);

INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES (gen_random_uuid(), 'instagram-assets', 'malicious.png', '11111111-2222-3333-4444-555555555555'::uuid);
-- Se a linha acima passar, a transação continua (falha do teste). Se o RLS bloquear, gera erro esperado.
ROLLBACK;

-- Teste 2: Usuário ADMIN tentando fazer INSERT em storage.objects no bucket instagram-assets
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dbfecd10-d70b-464a-86f1-2ff178496db0', true);

INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES ('99999999-9999-9999-9999-999999999999'::uuid, 'instagram-assets', 'admin_post.png', 'dbfecd10-d70b-464a-86f1-2ff178496db0'::uuid);

SELECT id, name, bucket_id FROM storage.objects WHERE id = '99999999-9999-9999-9999-999999999999'::uuid;
ROLLBACK;

-- Teste 3: Leitura pública (anon) de objetos no bucket instagram-assets
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS public_assets_visible
FROM storage.objects
WHERE bucket_id = 'instagram-assets';
ROLLBACK;
