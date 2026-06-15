-- Migration to add trial and cancellation columns to user_subscriptions and profiles
-- Run this to update the schema in Supabase

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_start timestamptz NULL,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_id text NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text NULL,
  ADD COLUMN IF NOT EXISTS trial_start timestamptz NULL,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz NULL,
  ADD COLUMN IF NOT EXISTS trial_days_remaining integer NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text NULL;

-- Add index to optimize queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON public.user_subscriptions(trial_end) WHERE trial_end IS NOT NULL;
