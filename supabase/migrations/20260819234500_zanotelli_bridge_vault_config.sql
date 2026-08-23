begin;

create extension if not exists supabase_vault;

create table if not exists public.zanotelli_internal_bridge_config (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  receiver_url text not null default 'https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/zuno-inbound-bridge',
  hmac_vault_secret_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint zanotelli_internal_bridge_receiver_locked
    check (receiver_url = 'https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/zuno-inbound-bridge'),
  constraint zanotelli_internal_bridge_enable_requires_secret
    check (enabled is false or hmac_vault_secret_id is not null)
);

alter table public.zanotelli_internal_bridge_config enable row level security;
alter table public.zanotelli_internal_bridge_config force row level security;

revoke all on public.zanotelli_internal_bridge_config from public, anon, authenticated;
grant select, insert, update, delete on public.zanotelli_internal_bridge_config to service_role;

create or replace function public.set_zanotelli_internal_bridge_config_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_zanotelli_internal_bridge_config_updated_at
  before update on public.zanotelli_internal_bridge_config
  for each row execute procedure public.set_zanotelli_internal_bridge_config_updated_at();

create or replace function public.internal_read_zanotelli_bridge_config(p_user_id uuid)
returns table (
  enabled boolean,
  receiver_url text,
  hmac_secret text
)
language sql
security definer
stable
set search_path = public, vault, pg_temp
as $$
  select
    c.enabled,
    c.receiver_url,
    secret.decrypted_secret
  from public.zanotelli_internal_bridge_config c
  left join vault.decrypted_secrets secret
    on secret.id = c.hmac_vault_secret_id
  where c.owner_user_id = p_user_id
  limit 1;
$$;

revoke all on function public.internal_read_zanotelli_bridge_config(uuid) from public, anon, authenticated;
grant execute on function public.internal_read_zanotelli_bridge_config(uuid) to service_role;

insert into public.zanotelli_internal_bridge_config(owner_user_id, enabled)
values ('293cbcc2-1262-4e22-845c-8178ca1dddff'::uuid, false)
on conflict (owner_user_id) do nothing;

comment on table public.zanotelli_internal_bridge_config is
  'Backend-only Zuno→Zanotelli bridge config. HMAC is stored only as a Supabase Vault reference; the receiver URL is pinned to the Zanotelli project.';
comment on function public.internal_read_zanotelli_bridge_config(uuid) is
  'Service-role-only read of the enabled flag, pinned receiver URL and decrypted HMAC for the exact internal ADM owner.';

commit;