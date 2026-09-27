alter table public.billing_provider_config
  add column if not exists starter_intro_offer_enabled boolean not null default true,
  add column if not exists starter_intro_offer_key text not null default 'first_month_29_90',
  add column if not exists starter_intro_offer_plan_id text not null default 'starter',
  add column if not exists starter_intro_offer_billing_cycle text not null default 'monthly',
  add column if not exists starter_intro_offer_conversion_path text not null default 'direct_purchase',
  add column if not exists starter_intro_offer_intro_amount_cents integer not null default 2990,
  add column if not exists starter_intro_offer_regular_amount_cents integer not null default 4700,
  add column if not exists starter_intro_offer_duration text not null default 'first_billing_period',
  add column if not exists stripe_starter_intro_coupon_id text;

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_starter_intro_offer_plan_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_starter_intro_offer_plan_check
  check (starter_intro_offer_plan_id = 'starter');

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_starter_intro_offer_cycle_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_starter_intro_offer_cycle_check
  check (starter_intro_offer_billing_cycle = 'monthly');

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_starter_intro_offer_path_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_starter_intro_offer_path_check
  check (starter_intro_offer_conversion_path = 'direct_purchase');

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_starter_intro_offer_amount_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_starter_intro_offer_amount_check
  check (
    starter_intro_offer_intro_amount_cents > 0
    and starter_intro_offer_regular_amount_cents > starter_intro_offer_intro_amount_cents
  );

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_starter_intro_offer_duration_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_starter_intro_offer_duration_check
  check (starter_intro_offer_duration = 'first_billing_period');

update public.billing_provider_config
set
  starter_intro_offer_enabled = true,
  starter_intro_offer_key = 'first_month_29_90',
  starter_intro_offer_plan_id = 'starter',
  starter_intro_offer_billing_cycle = 'monthly',
  starter_intro_offer_conversion_path = 'direct_purchase',
  starter_intro_offer_intro_amount_cents = 2990,
  starter_intro_offer_regular_amount_cents = 4700,
  starter_intro_offer_duration = 'first_billing_period',
  stripe_starter_intro_coupon_id = 'starter_first_month_29_90_v1',
  updated_at = now()
where singleton = true;

create table if not exists public.billing_intro_offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_key text not null,
  plan_id text not null check (plan_id in ('starter','pro','agency')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  conversion_path text not null check (conversion_path in ('trial','direct_purchase')),
  billing_provider text not null check (billing_provider in ('stripe','mercado_pago')),
  intro_amount_cents integer not null check (intro_amount_cents > 0),
  regular_amount_cents integer not null check (regular_amount_cents > intro_amount_cents),
  provider_coupon_id text,
  provider_customer_id text,
  provider_checkout_id text,
  provider_subscription_id text,
  provider_invoice_id text,
  claim_generation integer not null default 1 check (claim_generation > 0),
  status text not null default 'claimed' check (status in ('claimed','redeemed')),
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  last_checkout_created_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, offer_key)
);

create unique index if not exists billing_intro_offer_provider_checkout_unique
  on public.billing_intro_offer_redemptions(provider_checkout_id)
  where provider_checkout_id is not null;

create unique index if not exists billing_intro_offer_provider_subscription_unique
  on public.billing_intro_offer_redemptions(provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.billing_intro_offer_redemptions enable row level security;
revoke all on table public.billing_intro_offer_redemptions from anon, authenticated;
grant select, insert, update on table public.billing_intro_offer_redemptions to service_role;
