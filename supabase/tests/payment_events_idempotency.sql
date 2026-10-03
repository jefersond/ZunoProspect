-- Idempotency test for public.payment_events.
-- Run ONLY against a disposable Postgres database (see
-- supabase/tests/run-payment-events-idempotency.sh). It creates and drops
-- objects in the public schema.
\set ON_ERROR_STOP on
\set QUIET on

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  provider text not null default 'stripe',
  provider_event_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  plan_name text,
  amount integer,
  currency text,
  status text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Production state before the fix: partial unique index only.
create unique index idx_payment_events_provider_event_id
  on public.payment_events (provider, provider_event_id)
  where provider_event_id is not null;

-- Existing data shape seen in production: legacy rows without provider_event_id.
insert into public.payment_events (event_type, provider, provider_event_id, status)
values
  ('invoice.paid', 'stripe', null, 'open'),
  ('invoice.paid', 'stripe', null, 'open'),
  ('invoice.paid', 'stripe', 'evt_existing_1', 'paid');

-- 0. Reproduce the bug: the webhook's upsert raises 42P10 before the migration.
do $$
begin
  begin
    insert into public.payment_events (event_type, provider, provider_event_id, status)
    values ('payment', 'mercado_pago', 'webhook:probe', 'processed')
    on conflict (provider, provider_event_id) do update set status = excluded.status;
    raise exception 'TEST FAIL: expected 42P10 before migration';
  exception when sqlstate '42P10' then
    raise notice 'PASS 0: upsert raises 42P10 before migration (bug reproduced)';
  end;
end;
$$;

\i supabase/migrations/20261003120000_payment_events_provider_event_unique.sql

-- Re-applying the migration must be a no-op.
\i supabase/migrations/20261003120000_payment_events_provider_event_unique.sql

do $$
declare
  v_count integer;
  v_status text;
begin
  select count(*) into v_count from public.payment_events;
  if v_count <> 3 then raise exception 'TEST FAIL: existing rows changed (count=%)', v_count; end if;
  raise notice 'PASS 1: migration preserved all existing rows (3), including NULL provider_event_id';

  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_payment_events_provider_event_id') then
    raise exception 'TEST FAIL: partial index still present';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payment_events'::regclass
      and conname = 'payment_events_provider_event_id_key' and contype = 'u'
  ) then
    raise exception 'TEST FAIL: unique constraint missing';
  end if;
  raise notice 'PASS 2: partial index replaced by UNIQUE (provider, provider_event_id)';

  -- First delivery is stored.
  insert into public.payment_events (event_type, provider, provider_event_id, status, event_data)
  values ('payment', 'mercado_pago', 'webhook:1001', 'failed', '{"attempt":1}')
  on conflict (provider, provider_event_id) do update
    set status = excluded.status, event_data = excluded.event_data;
  select count(*) into v_count from public.payment_events where provider = 'mercado_pago' and provider_event_id = 'webhook:1001';
  if v_count <> 1 then raise exception 'TEST FAIL: first event not stored once (count=%)', v_count; end if;
  raise notice 'PASS 3: first event stored, upsert did not raise 42P10';

  -- Retry of the same event does not duplicate and updates in place.
  insert into public.payment_events (event_type, provider, provider_event_id, status, event_data)
  values ('payment', 'mercado_pago', 'webhook:1001', 'processed', '{"attempt":2}')
  on conflict (provider, provider_event_id) do update
    set status = excluded.status, event_data = excluded.event_data;
  select count(*), max(status) into v_count, v_status
  from public.payment_events where provider = 'mercado_pago' and provider_event_id = 'webhook:1001';
  if v_count <> 1 or v_status <> 'processed' then
    raise exception 'TEST FAIL: retry duplicated or did not update (count=%, status=%)', v_count, v_status;
  end if;
  raise notice 'PASS 4: retry of same provider_event_id did not duplicate (status updated to processed)';

  -- A distinct provider_event_id creates a new row.
  insert into public.payment_events (event_type, provider, provider_event_id, status)
  values ('payment', 'mercado_pago', 'webhook:1002', 'processed')
  on conflict (provider, provider_event_id) do update set status = excluded.status;
  select count(*) into v_count from public.payment_events where provider = 'mercado_pago';
  if v_count <> 2 then raise exception 'TEST FAIL: distinct event not stored (count=%)', v_count; end if;
  raise notice 'PASS 5: distinct provider_event_id created a new row';

  -- Same id under another provider is independent (Stripe semantics untouched).
  insert into public.payment_events (event_type, provider, provider_event_id, status)
  values ('invoice.paid', 'stripe', 'webhook:1001', 'paid')
  on conflict (provider, provider_event_id) do update set status = excluded.status;
  select count(*) into v_count from public.payment_events where provider_event_id = 'webhook:1001';
  if v_count <> 2 then raise exception 'TEST FAIL: providers not independent (count=%)', v_count; end if;
  raise notice 'PASS 6: same provider_event_id under a different provider stays independent';

  -- Stripe-style upsert keyed by event.id works and is idempotent.
  insert into public.payment_events (event_type, provider, provider_event_id, status)
  values ('invoice.paid', 'stripe', 'evt_existing_1', 'paid')
  on conflict (provider, provider_event_id) do update set status = excluded.status;
  select count(*) into v_count from public.payment_events where provider_event_id = 'evt_existing_1';
  if v_count <> 1 then raise exception 'TEST FAIL: stripe upsert duplicated (count=%)', v_count; end if;
  raise notice 'PASS 7: stripe-webhook style upsert is compatible and idempotent';

  -- NULL provider_event_id rows are still unconstrained.
  insert into public.payment_events (event_type, provider, provider_event_id, status)
  values ('invoice.paid', 'stripe', null, 'open');
  select count(*) into v_count from public.payment_events where provider_event_id is null;
  if v_count <> 3 then raise exception 'TEST FAIL: NULL rows constrained (count=%)', v_count; end if;
  raise notice 'PASS 8: multiple NULL provider_event_id rows still allowed';
end;
$$;
