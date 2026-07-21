-- Marketing Operations: central orchestrator, specialist tasks and approval gates.

CREATE TABLE IF NOT EXISTS public.marketing_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  company_name text NOT NULL DEFAULT 'Zuno Propect',
  product_context text NOT NULL DEFAULT 'Plataforma de prospeccao B2B que encontra empresas por cidade e nicho, organiza leads e gera diagnosticos e abordagens contextualizadas com IA.',
  primary_offer text NOT NULL DEFAULT 'Teste gratis de 7 dias da Zuno Propect',
  default_audience text NOT NULL DEFAULT 'Prestadores de servicos B2B, agencias e profissionais comerciais que precisam prospectar com mais consistencia.',
  brand_voice text NOT NULL DEFAULT 'Direta, humana, pratica, confiavel e sem promessas de resultado garantido.',
  approval_mode text NOT NULL DEFAULT 'approval'
    CHECK (approval_mode IN ('approval', 'automatic')),
  monthly_paid_media_cap numeric(12,2) NOT NULL DEFAULT 0
    CHECK (monthly_paid_media_cap >= 0),
  daily_paid_media_cap numeric(12,2) NOT NULL DEFAULT 0
    CHECK (daily_paid_media_cap >= 0),
  auto_daily_planning boolean NOT NULL DEFAULT false,
  daily_planning_time time NOT NULL DEFAULT '07:30:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  guardrails jsonb NOT NULL DEFAULT jsonb_build_object(
    'paid_media_requires_approval', true,
    'publishing_requires_approval', true,
    'outreach_requires_approval', true,
    'no_invented_claims', true,
    'official_whatsapp_only', true,
    'max_active_paid_campaigns', 1
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  objective text NOT NULL,
  offer text NOT NULL,
  target_audience text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['instagram', 'whatsapp']::text[],
  paid_media_monthly_budget numeric(12,2) NOT NULL DEFAULT 0
    CHECK (paid_media_monthly_budget >= 0),
  paid_media_daily_budget numeric(12,2) NOT NULL DEFAULT 0
    CHECK (paid_media_daily_budget >= 0),
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('draft', 'planning', 'generating', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'failed')),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  orchestrator_summary text,
  next_action text,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  brief text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'pending_approval', 'approved', 'rejected', 'completed', 'failed')),
  requires_approval boolean NOT NULL DEFAULT true,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_notes text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, stage_order, agent_key)
);

CREATE TABLE IF NOT EXISTS public.marketing_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  model text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.marketing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  approval_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status_created
  ON public.marketing_campaigns(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_campaign_stage
  ON public.marketing_tasks(campaign_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status_stage
  ON public.marketing_tasks(status, stage_order);
CREATE INDEX IF NOT EXISTS idx_marketing_runs_task_started
  ON public.marketing_agent_runs(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_approvals_pending
  ON public.marketing_approvals(status, requested_at DESC);

ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage marketing settings" ON public.marketing_settings;
CREATE POLICY "Admins manage marketing settings"
ON public.marketing_settings FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage marketing campaigns" ON public.marketing_campaigns;
CREATE POLICY "Admins manage marketing campaigns"
ON public.marketing_campaigns FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage marketing tasks" ON public.marketing_tasks;
CREATE POLICY "Admins manage marketing tasks"
ON public.marketing_tasks FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read marketing runs" ON public.marketing_agent_runs;
CREATE POLICY "Admins read marketing runs"
ON public.marketing_agent_runs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage marketing approvals" ON public.marketing_approvals;
CREATE POLICY "Admins manage marketing approvals"
ON public.marketing_approvals FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_tasks TO authenticated;
GRANT SELECT ON public.marketing_agent_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_approvals TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_marketing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_settings_updated_at ON public.marketing_settings;
CREATE TRIGGER trg_marketing_settings_updated_at
BEFORE UPDATE ON public.marketing_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER trg_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_tasks_updated_at ON public.marketing_tasks;
CREATE TRIGGER trg_marketing_tasks_updated_at
BEFORE UPDATE ON public.marketing_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_updated_at();

COMMENT ON TABLE public.marketing_campaigns IS
  'Admin-only marketing campaigns coordinated by the Zuno Marketing Director agent.';
COMMENT ON TABLE public.marketing_tasks IS
  'Persistent handoffs and deliverables for every marketing specialist agent.';
COMMENT ON COLUMN public.marketing_campaigns.paid_media_monthly_budget IS
  'Teto exclusivo de investimento em anuncios pagos; nao limita agentes, conteudo organico, prospeccao ou ferramentas.';
