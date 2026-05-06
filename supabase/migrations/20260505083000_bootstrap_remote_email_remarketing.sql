-- Bootstrap email remarketing tables for remote projects whose migration
-- history is out of sync with the existing schema.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  assunto text NOT NULL,
  conteudo text NOT NULL,
  segmento text NOT NULL DEFAULT 'todos',
  status text NOT NULL DEFAULT 'rascunho',
  total_enviados integer NOT NULL DEFAULT 0,
  total_abertos integer NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  recipient_count integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view campaigns" ON public.email_campaigns;
CREATE POLICY "Admins can view campaigns" ON public.email_campaigns
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.email_campaigns;
CREATE POLICY "Admins can insert campaigns" ON public.email_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update campaigns" ON public.email_campaigns;
CREATE POLICY "Admins can update campaigns" ON public.email_campaigns
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.email_campaigns;
CREATE POLICY "Admins can delete campaigns" ON public.email_campaigns
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  queue_id uuid,
  user_id uuid NOT NULL,
  user_email_masked text NOT NULL,
  user_email_encrypted bytea,
  user_email_fingerprint text,
  status text NOT NULL DEFAULT 'enviado',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  retention_expires_at timestamptz DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS queue_id uuid,
  ADD COLUMN IF NOT EXISTS user_email_masked text,
  ADD COLUMN IF NOT EXISTS user_email_encrypted bytea,
  ADD COLUMN IF NOT EXISTS user_email_fingerprint text,
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz DEFAULT (now() + interval '90 days'),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

UPDATE public.email_logs
SET user_email_masked = COALESCE(user_email_masked, '*@unknown')
WHERE user_email_masked IS NULL;

ALTER TABLE public.email_logs
  ALTER COLUMN user_email_masked SET NOT NULL;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view logs" ON public.email_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.email_logs;
DROP POLICY IF EXISTS "Block direct select on email_logs" ON public.email_logs;
CREATE POLICY "Block direct select on email_logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Block direct insert on email_logs" ON public.email_logs;
CREATE POLICY "Block direct insert on email_logs"
  ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Service role full access on email_logs" ON public.email_logs;
CREATE POLICY "Service role full access on email_logs"
  ON public.email_logs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  html_content text NOT NULL,
  email_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  metadata jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  user_id uuid,
  provider text,
  provider_message_id text,
  opened_at timestamptz,
  clicked_at timestamptz
);

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on email_queue" ON public.email_queue;
CREATE POLICY "Service role full access on email_queue"
  ON public.email_queue FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view email_queue" ON public.email_queue;
CREATE POLICY "Admins can view email_queue"
  ON public.email_queue FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Block authenticated insert on email_queue" ON public.email_queue;
CREATE POLICY "Block authenticated insert on email_queue"
  ON public.email_queue FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Block authenticated update on email_queue" ON public.email_queue;
CREATE POLICY "Block authenticated update on email_queue"
  ON public.email_queue FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Block authenticated delete on email_queue" ON public.email_queue;
CREATE POLICY "Block authenticated delete on email_queue"
  ON public.email_queue FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.onboarding_emails_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL DEFAULT 'first_24h',
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_type)
);

ALTER TABLE public.onboarding_emails_sent
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

ALTER TABLE public.onboarding_emails_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view onboarding emails" ON public.onboarding_emails_sent;
CREATE POLICY "Admins can view onboarding emails"
  ON public.onboarding_emails_sent FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

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

CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON public.email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_queue_id ON public.email_logs(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_fingerprint ON public.email_logs(user_email_fingerprint);
CREATE INDEX IF NOT EXISTS idx_email_logs_retention ON public.email_logs(retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_segmento ON public.email_campaigns(segmento);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_email_type ON public.email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_created ON public.email_queue(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_campaign_user_unique
  ON public.email_queue(campaign_id, user_id)
  WHERE campaign_id IS NOT NULL AND user_id IS NOT NULL AND email_type = 'campaign';
CREATE INDEX IF NOT EXISTS idx_onboarding_emails_user_id ON public.onboarding_emails_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_emails_type ON public.onboarding_emails_sent(email_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_emails_opened ON public.onboarding_emails_sent(email_type, opened_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_emails_user_type ON public.onboarding_emails_sent(user_id, email_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_user_id ON public.email_unsubscribes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_fingerprint ON public.email_unsubscribes(email_fingerprint);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_queue_id ON public.email_events(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type_created ON public.email_events(event_type, created_at);

