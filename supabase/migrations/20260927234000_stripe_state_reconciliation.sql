create table if not exists public.billing_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','mercado_pago')),
  reason text not null,
  input_count integer not null default 0,
  changed_count integer not null default 0,
  missing_count integer not null default 0,
  before_counts jsonb not null default '{}'::jsonb,
  after_counts jsonb not null default '{}'::jsonb,
  provider_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_reconciliation_audit enable row level security;
revoke all on table public.billing_reconciliation_audit from anon, authenticated;
grant select, insert on table public.billing_reconciliation_audit to service_role;

create or replace function public.reconcile_stripe_subscription_states(
  p_snapshot jsonb,
  p_reason text default 'stripe_live_reconciliation'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_subscription_id text;
  v_provider_status text;
  v_local_status text;
  v_cancel_at_period_end boolean;
  v_canceled_at timestamptz;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_changed integer := 0;
  v_missing integer := 0;
  v_input integer := 0;
  v_rows integer := 0;
begin
  if jsonb_typeof(p_snapshot) <> 'array' then
    raise exception 'snapshot_must_be_array';
  end if;

  select jsonb_build_object(
    'total', count(*)::int,
    'active', count(*) filter (where coalesce(subscription_status,status)='active')::int,
    'trialing', count(*) filter (where coalesce(subscription_status,status)='trialing')::int,
    'cancelled', count(*) filter (where coalesce(subscription_status,status) in ('cancelled','canceled'))::int
  )
  into v_before
  from public.user_subscriptions
  where stripe_subscription_id is not null;

  for v_item in select value from jsonb_array_elements(p_snapshot)
  loop
    v_input := v_input + 1;
    v_subscription_id := nullif(v_item->>'subscription_id','');
    v_provider_status := lower(coalesce(v_item->>'status',''));
    v_local_status := case when v_provider_status='canceled' then 'cancelled' else v_provider_status end;

    if v_subscription_id is null or v_local_status not in ('active','trialing','cancelled','past_due','unpaid','incomplete','incomplete_expired','paused') then
      raise exception 'invalid_snapshot_item:%', v_item::text;
    end if;

    v_cancel_at_period_end := coalesce((v_item->>'cancel_at_period_end')::boolean, false);
    v_canceled_at := case
      when coalesce(v_item->>'canceled_at','') ~ '^[0-9]+$' and (v_item->>'canceled_at')::bigint > 0
        then to_timestamp((v_item->>'canceled_at')::bigint)
      else null
    end;
    v_trial_start := case
      when coalesce(v_item->>'trial_start','') ~ '^[0-9]+$' and (v_item->>'trial_start')::bigint > 0
        then to_timestamp((v_item->>'trial_start')::bigint)
      else null
    end;
    v_trial_end := case
      when coalesce(v_item->>'trial_end','') ~ '^[0-9]+$' and (v_item->>'trial_end')::bigint > 0
        then to_timestamp((v_item->>'trial_end')::bigint)
      else null
    end;

    update public.user_subscriptions
    set
      subscription_status = v_local_status,
      status = v_local_status,
      cancel_at_period_end = v_cancel_at_period_end,
      canceled_at = v_canceled_at,
      trial_start = v_trial_start,
      trial_end = v_trial_end,
      updated_at = now()
    where stripe_subscription_id = v_subscription_id
      and (billing_provider = 'stripe' or billing_provider is null)
      and (
        subscription_status is distinct from v_local_status
        or status is distinct from v_local_status
        or cancel_at_period_end is distinct from v_cancel_at_period_end
        or canceled_at is distinct from v_canceled_at
        or trial_start is distinct from v_trial_start
        or trial_end is distinct from v_trial_end
      );

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      if not exists (
        select 1 from public.user_subscriptions
        where stripe_subscription_id = v_subscription_id
          and (billing_provider = 'stripe' or billing_provider is null)
      ) then
        v_missing := v_missing + 1;
      end if;
    else
      v_changed := v_changed + v_rows;
    end if;
  end loop;

  select jsonb_build_object(
    'total', count(*)::int,
    'active', count(*) filter (where coalesce(subscription_status,status)='active')::int,
    'trialing', count(*) filter (where coalesce(subscription_status,status)='trialing')::int,
    'cancelled', count(*) filter (where coalesce(subscription_status,status) in ('cancelled','canceled'))::int
  )
  into v_after
  from public.user_subscriptions
  where stripe_subscription_id is not null;

  insert into public.billing_reconciliation_audit(
    provider, reason, input_count, changed_count, missing_count, before_counts, after_counts, provider_snapshot
  )
  values (
    'stripe',
    left(coalesce(nullif(p_reason,''),'stripe_live_reconciliation'),160),
    v_input,
    v_changed,
    v_missing,
    v_before,
    v_after,
    p_snapshot
  );

  return jsonb_build_object(
    'provider','stripe',
    'input_count',v_input,
    'changed_count',v_changed,
    'missing_count',v_missing,
    'before',v_before,
    'after',v_after
  );
end;
$$;

revoke all on function public.reconcile_stripe_subscription_states(jsonb,text) from public, anon, authenticated;
grant execute on function public.reconcile_stripe_subscription_states(jsonb,text) to service_role;
