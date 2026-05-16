-- Diagnostico de RLS para o projeto Supabase ihtltqxxlvbsxbiacbpr.
-- Rode no Supabase SQL Editor antes de aplicar a migration de hardening.

-- Visao simples pedida no alerta.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Visao direta via catalogo do Postgres.
select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- Apenas tabelas publicas com RLS desativado.
select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  case
    when c.relname in (
      'profiles',
      'leads',
      'saved_leads',
      'user_usage',
      'user_subscriptions',
      'subscriptions',
      'user_addons',
      'referrals',
      'search_logs',
      'email_events',
      'email_logs',
      'interacoes',
      'templates_mensagens',
      'campanhas',
      'campaigns',
      'leads_campanhas',
      'reports',
      'api_keys'
    ) then 'critica: dados de usuario'
    when c.relname in (
      'plans',
      'pricing',
      'public_config',
      'app_config',
      'lead_pricing_tiers',
      'templates_globais'
    ) then 'leitura publica/controlada'
    when c.relname in (
      'email_campaigns',
      'email_queue',
      'email_unsubscribes',
      'email_ab_tests',
      'email_ab_results',
      'onboarding_emails_sent',
      'welcome_emails_sent',
      'email_job_locks',
      'payment_events',
      'app_events',
      'security_events',
      'leads_access_log',
      'leads_audit_log',
      'email_logs_access_audit',
      'user_roles'
    ) then 'critica: administrativa/backend'
    else 'revisar manualmente'
  end as classificacao_sugerida
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by classificacao_sugerida, c.relname;

-- Conferencia de policies existentes por tabela.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
