-- Safety layer for email remarketing and campaign sends.

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_segmento_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_segmento_check
  CHECK (
    segmento = ANY (
      ARRAY[
        'todos',
        'starter',
        'pro',
        'agencia',
        'inativos',
        'starter_inativos',
        'nao_pagantes',
        'engajados_nao_pagantes',
        'proximo_limite',
        'never_searched',
        'searched_not_returned',
        'free_active',
        'inactive_old',
        'clicked_pricing',
        'signup_not_paid',
        'paying',
        'internal_admins'
      ]::text[]
    )
  );

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'rascunho',
        'ativa',
        'pausada',
        'enviando',
        'enviada',
        'erro',
        'finalizada'
      ]::text[]
    )
  );

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  email_fingerprint text,
  source text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (email_fingerprint)
);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on email_unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Service role full access on email_unsubscribes"
  ON public.email_unsubscribes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view email_unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Admins can view email_unsubscribes"
  ON public.email_unsubscribes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  queue_id uuid,
  user_id uuid,
  email_type text,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on email_events" ON public.email_events;
CREATE POLICY "Service role full access on email_events"
  ON public.email_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view email_events" ON public.email_events;
CREATE POLICY "Admins can view email_events"
  ON public.email_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS queue_id uuid;

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_user_id ON public.email_unsubscribes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_fingerprint ON public.email_unsubscribes(email_fingerprint);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_queue_id ON public.email_events(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type_created ON public.email_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_created ON public.email_queue(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_campaign_user_unique
  ON public.email_queue(campaign_id, user_id)
  WHERE campaign_id IS NOT NULL AND user_id IS NOT NULL AND email_type = 'campaign';

ALTER TABLE public.onboarding_emails_sent
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

CREATE OR REPLACE FUNCTION public.increment_email_campaign_open(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_abertos = COALESCE(total_abertos, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;
