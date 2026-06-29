-- Migration to add payment recovery columns to user_subscriptions and profiles
-- and create the payment_recovery_email_logs table

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS status text NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NULL,
  ADD COLUMN IF NOT EXISTS latest_invoice_id text NULL,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url text NULL,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_payment_succeeded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS amount_remaining integer NULL,
  ADD COLUMN IF NOT EXISTS amount_due integer NULL,
  ADD COLUMN IF NOT EXISTS invoice_attempt_count integer NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text NULL,
  ADD COLUMN IF NOT EXISTS current_plan text NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NULL;

-- Create payment recovery email logs table
CREATE TABLE IF NOT EXISTS public.payment_recovery_email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invoice_id text NOT NULL,
    subscription_id text NULL,
    email text NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL,
    sent_at timestamptz NULL,
    error_message text NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_recovery_email_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for payment_recovery_email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_recovery_email_logs' 
      AND policyname = 'Admins can do everything on payment recovery logs'
  ) THEN
    CREATE POLICY "Admins can do everything on payment recovery logs" 
      ON public.payment_recovery_email_logs 
      FOR ALL 
      USING (
        auth.jwt() ->> 'email' = 'jeferson.zanotell@gmail.com' 
        OR auth.jwt() ->> 'email' = 'jefeson.zanotell@gmail.com'
      );
  END IF;
END
$$;
