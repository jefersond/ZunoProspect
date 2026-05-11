-- Admin Fase 3: eventos globais, logs de pesquisa, pagamentos e base anti-abuso.

CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_events_user_created ON public.app_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type_created ON public.app_events(event_type, created_at DESC);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read app events" ON public.app_events;
CREATE POLICY "Admins can read app events"
ON public.app_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage app events" ON public.app_events;
CREATE POLICY "Service role can manage app events"
ON public.app_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  city text,
  state text,
  country text DEFAULT 'BR',
  niche text,
  focus text,
  requested_quantity integer,
  returned_quantity integer,
  status text NOT NULL DEFAULT 'started',
  error_message text,
  duration_ms integer,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_created ON public.search_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_run_id ON public.search_logs(search_run_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_status_created ON public.search_logs(status, created_at DESC);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read search logs" ON public.search_logs;
CREATE POLICY "Admins can read search logs"
ON public.search_logs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage search logs" ON public.search_logs;
CREATE POLICY "Service role can manage search logs"
ON public.search_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  plan_name text,
  amount integer,
  currency text,
  status text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event_id
ON public.payment_events(provider, provider_event_id)
WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_user_created ON public.payment_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_type_created ON public.payment_events(event_type, created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payment events" ON public.payment_events;
CREATE POLICY "Admins can read payment events"
ON public.payment_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage payment events" ON public.payment_events;
CREATE POLICY "Service role can manage payment events"
ON public.payment_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS suspected_abuse boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abuse_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_referrals_status_created ON public.referrals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_suspected_abuse ON public.referrals(suspected_abuse) WHERE suspected_abuse = true;

UPDATE public.referrals r
SET status = CASE
      WHEN r.referrer_user_id = r.referred_user_id THEN 'rejected'
      WHEN EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = r.referred_user_id
          AND u.confirmed_at IS NOT NULL
      ) THEN 'approved'
      ELSE COALESCE(NULLIF(r.status, ''), 'pending')
    END,
    approved_at = CASE
      WHEN EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = r.referred_user_id
          AND u.confirmed_at IS NOT NULL
      ) THEN COALESCE(r.approved_at, r.created_at)
      ELSE r.approved_at
    END,
    suspected_abuse = CASE
      WHEN r.referrer_user_id = r.referred_user_id THEN true
      ELSE COALESCE(r.suspected_abuse, false)
    END,
    abuse_reason = CASE
      WHEN r.referrer_user_id = r.referred_user_id THEN COALESCE(r.abuse_reason, 'self_referral')
      ELSE r.abuse_reason
    END,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.log_app_event(
  p_user_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.app_events (user_id, event_type, event_data, ip_address, user_agent)
  VALUES (p_user_id, p_event_type, COALESCE(p_event_data, '{}'::jsonb), p_ip_address, p_user_agent)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_event(uuid, text, jsonb, text, text) TO authenticated, service_role;
