alter table public.billing_provider_config
  add column if not exists intro_offer_enabled boolean not null default true,
  add column if not exists intro_offer_key text not null default 'first_month_discount',
  add column if not exists intro_offer_duration text not null default 'first_billing_period',
  add column if not exists intro_offer_plans jsonb not null default '{}'::jsonb;

alter table public.billing_provider_config
  drop constraint if exists billing_provider_config_intro_offer_duration_check;
alter table public.billing_provider_config
  add constraint billing_provider_config_intro_offer_duration_check
  check (intro_offer_duration = 'first_billing_period');

update public.billing_provider_config
set
  intro_offer_enabled = true,
  intro_offer_key = 'first_month_discount',
  intro_offer_duration = 'first_billing_period',
  intro_offer_plans = jsonb_build_object(
    'starter', jsonb_build_object(
      'intro_amount_cents', 2990,
      'regular_amount_cents', 4700,
      'stripe_coupon_id', 'starter_first_month_29_90_v1'
    ),
    'pro', jsonb_build_object(
      'intro_amount_cents', 5990,
      'regular_amount_cents', 9700,
      'stripe_coupon_id', 'pro_first_month_59_90_v1'
    ),
    'agency', jsonb_build_object(
      'intro_amount_cents', 15990,
      'regular_amount_cents', 24700,
      'stripe_coupon_id', 'agency_first_month_159_90_v1'
    )
  ),
  updated_at = now()
where singleton = true;

update public.billing_intro_offer_redemptions
set offer_key = 'first_month_discount',
    updated_at = now()
where offer_key = 'first_month_29_90';

create unique index if not exists billing_intro_offer_one_lifetime_per_user
  on public.billing_intro_offer_redemptions(user_id);
