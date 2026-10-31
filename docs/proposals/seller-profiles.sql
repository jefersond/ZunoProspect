-- PROPOSTA / DOCUMENTAÇÃO TÉCNICA
--
-- Perfil comercial do assinante (quem fala e o que vende), usado pela análise com Gemini.
-- Uma linha por usuário, isolada por RLS (cada usuário só enxerga e altera a própria linha).
--
-- Leitura administrativa: NÃO há policy para admin. O painel lê pelo endpoint admin-get-users (service role),
-- que só responde depois de verificar is_admin de verdade.
--
-- Sequência segura de publicação (não inverter):
--   1) aplicar a migration supabase/migrations/20261031120000_create_seller_profiles.sql;
--   2) publicar a Edge Function analisar-lead-ia e admin-get-users;
--   3) publicar o frontend com VITE_SELLER_PROFILE_REMOTE=true
--      (perfis já salvos no navegador sobem sozinhos na primeira carga, sem sobrescrever o banco).
--   4) regenerar src/integrations/supabase/types.ts.

create table if not exists public.seller_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  company_name text not null default '' check (char_length(company_name) <= 80),
  service_category text not null default '' check (
    service_category in ('', 'trafego', 'social_media', 'sites', 'crm', 'automacao', 'seo', 'design', 'full_service', 'outro')
  ),
  service_offered text not null default '' check (char_length(service_offered) <= 120),
  offer_description text not null default '' check (char_length(offer_description) <= 600),
  target_audience text not null default '' check (char_length(target_audience) <= 300),
  commercial_maturity text not null default 'equilibrado' check (
    commercial_maturity in ('equilibrado', 'iniciante', 'intermediario', 'avancado')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.seller_profiles is
  'Perfil comercial do assinante usado para personalizar análises de IA. Dado do próprio usuário; sem dados de clientes.';

alter table public.seller_profiles enable row level security;

revoke all on public.seller_profiles from anon, public;
grant select, insert, update, delete on public.seller_profiles to authenticated;

create policy seller_profiles_select_own on public.seller_profiles
  for select to authenticated using (user_id = (select auth.uid()));

create policy seller_profiles_insert_own on public.seller_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy seller_profiles_update_own on public.seller_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy seller_profiles_delete_own on public.seller_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.touch_seller_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger seller_profiles_touch_updated_at
  before update on public.seller_profiles
  for each row execute function public.touch_seller_profiles_updated_at();
