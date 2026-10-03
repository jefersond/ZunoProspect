-- payment_events idempotency: make (provider, provider_event_id) usable by
-- ON CONFLICT (provider, provider_event_id).
--
-- Before this migration the only uniqueness was a PARTIAL unique index
-- (WHERE provider_event_id IS NOT NULL). PostgREST upserts send
-- ON CONFLICT (provider, provider_event_id) without an index predicate, and
-- Postgres cannot infer a partial index from that, so every upsert failed
-- with 42P10 ("there is no unique or exclusion constraint matching the
-- ON CONFLICT specification").
--
-- Semantics are preserved:
--   * rows with provider_event_id IS NULL stay allowed in any number
--     (UNIQUE treats NULLs as distinct by default);
--   * non-null (provider, provider_event_id) pairs were already unique under
--     the partial index, so no existing row can violate the new constraint;
--   * no row is updated or deleted.
--
-- Safety: the migration refuses to run if duplicates exist, instead of
-- deleting anything. Resolve them manually and re-run.

do $$
declare
  v_duplicates integer;
begin
  select count(*)
    into v_duplicates
  from (
    select 1
    from public.payment_events
    where provider_event_id is not null
    group by provider, provider_event_id
    having count(*) > 1
  ) d;

  if v_duplicates > 0 then
    raise exception
      'payment_events has % duplicated (provider, provider_event_id) group(s); resolve manually before applying this migration',
      v_duplicates
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists payment_events_provider_event_id_key
  on public.payment_events (provider, provider_event_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_events'::regclass
      and conname = 'payment_events_provider_event_id_key'
  ) then
    alter table public.payment_events
      add constraint payment_events_provider_event_id_key
      unique using index payment_events_provider_event_id_key;
  end if;
end;
$$;

-- The full unique constraint covers every lookup the partial index served.
drop index if exists public.idx_payment_events_provider_event_id;
