-- Migração criada para resolver o erro de tabelas comportamentais ausentes.
-- Alvo: public.behavior_email_queue, public.behavior_email_logs, public.email_unsubscribes.

-- ===================================================
-- 1. TABELA public.behavior_email_queue
-- ===================================================
CREATE TABLE IF NOT EXISTS public.behavior_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  automation_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  failed_at timestamptz NULL,
  skipped_at timestamptz NULL,
  skip_reason text NULL,
  resend_message_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_status
ON public.behavior_email_queue(status);

CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_scheduled_for
ON public.behavior_email_queue(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_email
ON public.behavior_email_queue(email);

CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_user_id
ON public.behavior_email_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_behavior_email_queue_automation_key
ON public.behavior_email_queue(automation_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_behavior_email_queue_email_automation
ON public.behavior_email_queue(email, automation_key);

-- ===================================================
-- 2. TABELA public.behavior_email_logs
-- ===================================================
CREATE TABLE IF NOT EXISTS public.behavior_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NULL REFERENCES public.behavior_email_queue(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  automation_key text NOT NULL,
  status text NOT NULL,
  resend_message_id text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_queue_id
ON public.behavior_email_logs(queue_id);

CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_email
ON public.behavior_email_logs(email);

CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_status
ON public.behavior_email_logs(status);

CREATE INDEX IF NOT EXISTS idx_behavior_email_logs_automation_key
ON public.behavior_email_logs(automation_key);

-- ===================================================
-- 3. TABELA public.email_unsubscribes
-- ===================================================
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text UNIQUE NOT NULL,
  email_fingerprint text UNIQUE NULL,
  source text NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email
ON public.email_unsubscribes(email);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_user_id
ON public.email_unsubscribes(user_id);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_fingerprint
ON public.email_unsubscribes(email_fingerprint);

-- ===================================================
-- 4. ATIVAR RLS COM POLICIES SEGURAS
-- ===================================================
ALTER TABLE public.behavior_email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Políticas para Service Role (necessário para Edge Functions e scripts DML de background)
DROP POLICY IF EXISTS "Service role full access on behavior_email_queue" ON public.behavior_email_queue;
CREATE POLICY "Service role full access on behavior_email_queue"
  ON public.behavior_email_queue FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on behavior_email_logs" ON public.behavior_email_logs;
CREATE POLICY "Service role full access on behavior_email_logs"
  ON public.behavior_email_logs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on email_unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Service role full access on email_unsubscribes"
  ON public.email_unsubscribes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas para Administrador Principal (jeferson.zanotell@gmail.com)
DROP POLICY IF EXISTS "Admin can read behavior email queue" ON public.behavior_email_queue;
CREATE POLICY "Admin can read behavior email queue"
ON public.behavior_email_queue
FOR SELECT
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com');

DROP POLICY IF EXISTS "Admin can manage behavior email queue" ON public.behavior_email_queue;
CREATE POLICY "Admin can manage behavior email queue"
ON public.behavior_email_queue
FOR ALL
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com')
WITH CHECK (auth.email() = 'jeferson.zanotell@gmail.com');

DROP POLICY IF EXISTS "Admin can read behavior email logs" ON public.behavior_email_logs;
CREATE POLICY "Admin can read behavior email logs"
ON public.behavior_email_logs
FOR SELECT
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com');

DROP POLICY IF EXISTS "Admin can manage behavior email logs" ON public.behavior_email_logs;
CREATE POLICY "Admin can manage behavior email logs"
ON public.behavior_email_logs
FOR ALL
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com')
WITH CHECK (auth.email() = 'jeferson.zanotell@gmail.com');

DROP POLICY IF EXISTS "Admin can read email unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Admin can read email unsubscribes"
ON public.email_unsubscribes
FOR SELECT
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com');

DROP POLICY IF EXISTS "Admin can manage email unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Admin can manage email unsubscribes"
ON public.email_unsubscribes
FOR ALL
TO authenticated
USING (auth.email() = 'jeferson.zanotell@gmail.com')
WITH CHECK (auth.email() = 'jeferson.zanotell@gmail.com');

-- Trigger de atualização de updated_at para a fila
DROP TRIGGER IF EXISTS update_behavior_email_queue_updated_at ON public.behavior_email_queue;
CREATE TRIGGER update_behavior_email_queue_updated_at
  BEFORE UPDATE ON public.behavior_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
