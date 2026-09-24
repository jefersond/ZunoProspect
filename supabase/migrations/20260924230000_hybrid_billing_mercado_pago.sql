alter table public.user_subscriptions
  add column if not exists billing_provider text,
  add column if not exists billing_provider_locked_at timestamptz,
  add column if not exists mercado_pago_subscription_id text,
  add column if not exists mercado_pago_plan_id text,
  add column if not exists mercado_pago_payer_id text,
  add column if not exists trial_duration_days integer,
  add column if not exists trial_policy_version text;

update public.user_subscriptions
set
  billing_provider = 'stripe',
  billing_provider_locked_at = coalesce(billing_provider_locked_at, updated_at, now())
where (stripe_customer_id is not null or stripe_subscription_id is not null)
  and billing_provider is null;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_billing_provider_check;
alter table public.user_subscriptions
  add constraint user_subscriptions_billing_provider_check
  check (billing_provider is null or billing_provider in ('stripe','mercado_pago'));

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_provider_exclusivity_check;
alter table public.user_subscriptions
  add constraint user_subscriptions_provider_exclusivity_check
  check (
    billing_provider is null
    or (
      billing_provider = 'stripe'
      and mercado_pago_subscription_id is null
    )
    or (
      billing_provider = 'mercado_pago'
      and stripe_customer_id is null
      and stripe_subscription_id is null
    )
  );

create unique index if not exists user_subscriptions_stripe_subscription_unique
  on public.user_subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists user_subscriptions_mercado_pago_subscription_unique
  on public.user_subscriptions(mercado_pago_subscription_id)
  where mercado_pago_subscription_id is not null;

create table if not exists public.billing_provider_config (
  singleton boolean primary key default true check (singleton),
  default_new_billing_provider text not null default 'stripe'
    check (default_new_billing_provider in ('stripe','mercado_pago')),
  stripe_trial_duration_days integer not null default 7 check (stripe_trial_duration_days > 0),
  stripe_trial_policy_version text not null default 'stripe_legacy_7d',
  mercado_pago_trial_duration_days integer not null default 4 check (mercado_pago_trial_duration_days > 0),
  mercado_pago_trial_policy_version text not null default '4d_2026_09',
  mercado_pago_cutover_ready boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.billing_provider_config(singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.billing_provider_config
  drop constraint if exists billing_provider_cutover_guard;
alter table public.billing_provider_config
  add constraint billing_provider_cutover_guard
  check (default_new_billing_provider = 'stripe' or mercado_pago_cutover_ready = true);

alter table public.billing_provider_config enable row level security;
revoke all on table public.billing_provider_config from anon, authenticated;
grant select, update on table public.billing_provider_config to service_role;

create table if not exists public.mercado_pago_billing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null check (plan_id in ('starter','pro','agency')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  trial_duration_days integer not null check (trial_duration_days > 0),
  trial_policy_version text not null,
  transaction_amount numeric(12,2) not null check (transaction_amount > 0),
  currency_id text not null default 'BRL',
  provider_plan_id text,
  status text not null default 'creating' check (status in ('creating','ready','failed','cancelled')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id,billing_cycle,trial_policy_version,transaction_amount,currency_id)
);

create unique index if not exists mercado_pago_billing_plans_provider_unique
  on public.mercado_pago_billing_plans(provider_plan_id)
  where provider_plan_id is not null;

alter table public.mercado_pago_billing_plans enable row level security;
revoke all on table public.mercado_pago_billing_plans from anon, authenticated;
grant select, insert, update on table public.mercado_pago_billing_plans to service_role;

create table if not exists public.mercado_pago_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter','pro','agency')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  trial_duration_days integer not null check (trial_duration_days > 0),
  trial_policy_version text not null,
  transaction_amount numeric(12,2) not null check (transaction_amount > 0),
  currency_id text not null default 'BRL',
  provider_plan_id text,
  provider_subscription_id text,
  checkout_url text,
  status text not null default 'creating' check (status in ('creating','ready','authorized','failed','cancelled')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,plan_id,billing_cycle,trial_policy_version,transaction_amount,currency_id)
);

create unique index if not exists mercado_pago_checkout_sessions_provider_unique
  on public.mercado_pago_checkout_sessions(provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.mercado_pago_checkout_sessions enable row level security;
revoke all on table public.mercado_pago_checkout_sessions from anon, authenticated;
grant select, insert, update on table public.mercado_pago_checkout_sessions to service_role;

create or replace function public.claim_billing_provider(
  p_user_id uuid,
  p_requested_provider text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_subscriptions%rowtype;
  v_provider text;
begin
  if p_requested_provider not in ('stripe','mercado_pago') then
    raise exception 'invalid_billing_provider';
  end if;

  insert into public.user_subscriptions(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
    into v_row
  from public.user_subscriptions
  where user_id = p_user_id
  for update;

  if v_row.stripe_customer_id is not null or v_row.stripe_subscription_id is not null then
    v_provider := 'stripe';
  elsif v_row.mercado_pago_subscription_id is not null then
    v_provider := 'mercado_pago';
  else
    v_provider := coalesce(v_row.billing_provider, p_requested_provider);
  end if;

  if v_row.billing_provider is not null and v_row.billing_provider <> v_provider then
    raise exception 'billing_provider_locked';
  end if;

  if v_provider = 'stripe' and v_row.mercado_pago_subscription_id is not null then
    raise exception 'billing_provider_conflict';
  end if;

  if v_provider = 'mercado_pago'
     and (v_row.stripe_customer_id is not null or v_row.stripe_subscription_id is not null) then
    raise exception 'billing_provider_conflict';
  end if;

  update public.user_subscriptions
  set
    billing_provider = v_provider,
    billing_provider_locked_at = coalesce(billing_provider_locked_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  return v_provider;
end;
$$;

revoke all on function public.claim_billing_provider(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_billing_provider(uuid,text) to service_role;
