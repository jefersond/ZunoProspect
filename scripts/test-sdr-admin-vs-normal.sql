DO $$
DECLARE
  v_admin_id uuid := 'dbfecd10-d70b-464a-86f1-2ff178496db0'::uuid;
  v_normal_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
BEGIN
  -- Garante que o admin tem perfil e user_role admin
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (v_admin_id, 'Admin Jeferson')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Garante que o usuario comum tem perfil sem role admin
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (v_normal_id, 'Usuario Comum')
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = v_normal_id AND role = 'admin';
END $$;

-- 1. TESTE ADMIN: Operações legítimas do SDR pelo Administrador
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dbfecd10-d70b-464a-86f1-2ff178496db0', true);
SELECT set_config('request.jwt.claim.email', 'jeferson.zanotell@gmail.com', true);

INSERT INTO public.leads (id, user_id, nome, cidade, nicho, foco, status, notas)
VALUES (
  '88888888-8888-8888-8888-888888888888'::uuid,
  'dbfecd10-d70b-464a-86f1-2ff178496db0'::uuid,
  'Lead SDR Oficial do Admin',
  'Curitiba',
  'Clínica',
  'zuno_internal_prospecting',
  'abertura_iniciada',
  '[SDR WhatsApp 2026-10-31] Abordagem institucional iniciada pelo operador.'
);

UPDATE public.leads
SET status = 'abertura_iniciada',
    notas = notas || E'\n[SDR WhatsApp 2026-10-31 11:15] Prospect respondeu positivamente.'
WHERE id = '88888888-8888-8888-8888-888888888888'::uuid;

SELECT id, nome, foco, status, 'SUCESSO: Admin operou o módulo SDR sem restrições' AS resultado
FROM public.leads
WHERE id = '88888888-8888-8888-8888-888888888888'::uuid;
ROLLBACK;

-- 2. TESTE USUÁRIO COMUM: Operação NORMAL de CRM permitida (status novo, em_contato, qualificacao, notas normais)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-2222-3333-4444-555555555555', true);
SELECT set_config('request.jwt.claim.email', 'test_storage_non_admin@local.test', true);

INSERT INTO public.leads (id, user_id, nome, cidade, nicho, foco, status, notas)
VALUES (
  '77777777-7777-7777-7777-777777777777'::uuid,
  '11111111-2222-3333-4444-555555555555'::uuid,
  'Cliente Normal da Loja',
  'São Paulo',
  'Restaurante',
  'Automação',
  'novo',
  '[Contato 2026-10-31] Enviada mensagem de apresentação no WhatsApp.'
);

UPDATE public.leads
SET status = 'em_contato',
    notas = notas || E'\n[Follow-up] Cliente pediu proposta comercial.'
WHERE id = '77777777-7777-7777-7777-777777777777'::uuid;

SELECT id, nome, foco, status, 'SUCESSO: Usuário comum opera CRM normal sem restrições' AS resultado
FROM public.leads
WHERE id = '77777777-7777-7777-7777-777777777777'::uuid;
ROLLBACK;
