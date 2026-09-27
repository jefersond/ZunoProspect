alter table public.mercado_pago_checkout_sessions
  add column if not exists conversion_path text not null default 'trial',
  add column if not exists intro_offer_applied boolean not null default false,
  add column if not exists intro_offer_key text,
  add column if not exists intro_amount_cents integer,
  add column if not exists regular_amount_cents integer;

alter table public.mercado_pago_checkout_sessions
  drop constraint if exists mercado_pago_checkout_sessions_trial_duration_days_check;
alter table public.mercado_pago_checkout_sessions
  add constraint mercado_pago_checkout_sessions_trial_duration_days_check
  check (trial_duration_days >= 0);

alter table public.mercado_pago_checkout_sessions
  drop constraint if exists mercado_pago_checkout_sessions_conversion_path_check;
alter table public.mercado_pago_checkout_sessions
  add constraint mercado_pago_checkout_sessions_conversion_path_check
  check (conversion_path in ('trial','direct_purchase'));

alter table public.mercado_pago_checkout_sessions
  drop constraint if exists mercado_pago_checkout_sessions_trial_direct_guard;
alter table public.mercado_pago_checkout_sessions
  add constraint mercado_pago_checkout_sessions_trial_direct_guard
  check (
    (conversion_path = 'trial' and trial_duration_days > 0)
    or
    (conversion_path = 'direct_purchase' and trial_duration_days = 0)
  );

alter table public.mercado_pago_checkout_sessions
  drop constraint if exists mercado_pago_checkout_sessions_intro_guard;
alter table public.mercado_pago_checkout_sessions
  add constraint mercado_pago_checkout_sessions_intro_guard
  check (
    intro_offer_applied = false
    or (
      conversion_path = 'direct_purchase'
      and billing_cycle = 'monthly'
      and intro_offer_key is not null
      and intro_amount_cents > 0
      and regular_amount_cents > intro_amount_cents
    )
  );

update public.mercado_pago_checkout_sessions
set
  conversion_path = 'trial',
  intro_offer_applied = false,
  regular_amount_cents = coalesce(regular_amount_cents, round(transaction_amount * 100)::integer)
where conversion_path is null
   or conversion_path = 'trial';

create index if not exists mercado_pago_checkout_sessions_user_conversion_idx
  on public.mercado_pago_checkout_sessions(user_id,conversion_path,status);
