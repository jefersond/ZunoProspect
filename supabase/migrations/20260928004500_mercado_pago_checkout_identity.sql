alter table public.mercado_pago_checkout_sessions
  drop constraint if exists mercado_pago_checkout_session_user_id_plan_id_billing_cycle_key;

create unique index if not exists mercado_pago_checkout_sessions_checkout_identity_unique
  on public.mercado_pago_checkout_sessions(
    user_id,
    plan_id,
    billing_cycle,
    trial_policy_version,
    transaction_amount,
    currency_id,
    conversion_path
  );
