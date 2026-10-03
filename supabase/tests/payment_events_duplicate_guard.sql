-- Duplicate-guard test for the payment_events migration.
-- Run ONLY against a disposable Postgres database. Expects the migration to
-- refuse to run (SQLSTATE 23505) and to leave every row in place.
\set ON_ERROR_STOP on
\set QUIET on

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  provider text not null default 'stripe',
  provider_event_id text,
  status text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Simulate a database where duplicates slipped in (no unique index at all).
insert into public.payment_events (event_type, provider, provider_event_id, status)
values
  ('payment', 'mercado_pago', 'webhook:dup', 'processed'),
  ('payment', 'mercado_pago', 'webhook:dup', 'processed'),
  ('payment', 'mercado_pago', 'webhook:ok', 'processed');

\set ON_ERROR_STOP off
\i supabase/migrations/20261003120000_payment_events_provider_event_unique.sql
\set ON_ERROR_STOP on

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.payment_events;
  if v_count <> 3 then raise exception 'TEST FAIL: rows were deleted or added (count=%)', v_count; end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.payment_events'::regclass
      and conname = 'payment_events_provider_event_id_key'
  ) then
    raise exception 'TEST FAIL: constraint created despite duplicates';
  end if;
  raise notice 'PASS 9: migration refused to run with duplicates and deleted nothing';
end;
$$;
