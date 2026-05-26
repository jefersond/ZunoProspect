-- Migration to create behavior email marketing tables
-- Target: public.behavior_email_queue and public.behavior_email_logs

CREATE TABLE IF NOT EXISTS public.behavior_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  automation_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  failed_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  resend_message_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT behavior_email_queue_email_key_unique UNIQUE (email, automation_key)
);

-- Enable RLS
ALTER TABLE public.behavior_email_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role full access on behavior_email_queue" ON public.behavior_email_queue;
DROP POLICY IF EXISTS "Admins can view behavior_email_queue" ON public.behavior_email_queue;

-- RLS Policies
CREATE POLICY "Service role full access on behavior_email_queue"
  ON public.behavior_email_queue FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view behavior_email_queue"
  ON public.behavior_email_queue FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.behavior_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.behavior_email_queue(id) ON DELETE SET NULL,
  user_id uuid,
  email text NOT NULL,
  automation_key text NOT NULL,
  status text NOT NULL,
  resend_message_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.behavior_email_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role full access on behavior_email_logs" ON public.behavior_email_logs;
DROP POLICY IF EXISTS "Admins can view behavior_email_logs" ON public.behavior_email_logs;

-- RLS Policies
CREATE POLICY "Service role full access on behavior_email_logs"
  ON public.behavior_email_logs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view behavior_email_logs"
  ON public.behavior_email_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_status_scheduled ON public.behavior_email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_email ON public.behavior_email_queue(email);
CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_user_key ON public.behavior_email_queue(user_id, automation_key);
CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_created_at ON public.behavior_email_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_queue_id ON public.behavior_email_logs(queue_id);
CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_user_id ON public.behavior_email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_email ON public.behavior_email_logs(email);
CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_created_at ON public.behavior_email_logs(created_at);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_behavior_email_queue_updated_at ON public.behavior_email_queue;
CREATE TRIGGER update_behavior_email_queue_updated_at
  BEFORE UPDATE ON public.behavior_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
