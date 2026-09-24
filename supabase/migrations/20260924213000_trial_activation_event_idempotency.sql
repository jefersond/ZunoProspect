-- Canonical trial/activation funnel idempotency on the existing app_events store.
-- No new analytics system: this only adds a durable idempotency key to the existing table.

alter table public.app_events
  add column if not exists dedupe_key text;

create unique index if not exists app_events_dedupe_key_unique
  on public.app_events(dedupe_key)
  where dedupe_key is not null;

create index if not exists app_events_trial_activation_funnel_idx
  on public.app_events(event_name, created_at desc)
  where event_name in (
    'card_added',
    'trial_started',
    'onboarding_started',
    'first_search',
    'first_results',
    'first_lead_opened',
    'first_value_reached',
    'returned_during_trial',
    'trial_converted_to_paid',
    'trial_cancelled',
    'subscription_cancelled',
    'payment_failed'
  );

comment on column public.app_events.dedupe_key is
  'Optional durable idempotency key for canonical product/billing milestones.';
