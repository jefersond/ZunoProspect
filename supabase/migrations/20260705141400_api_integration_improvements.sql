-- Migração para melhorias da API externa (Segurança, Concorrência, Idempotência e Acesso ADM)

-- 1. Modificações na tabela 'leads'
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS processing_agent_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS processing_lock_token text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS processing_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_processing_error text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_processing_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS analysis_id uuid DEFAULT NULL;

-- Garantir restrição de status operacional
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS chk_leads_processing_status,
ADD CONSTRAINT chk_leads_processing_status 
CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'awaiting_review', 'approved', 'rejected'));

-- Índice para acelerar busca de leads pendentes
CREATE INDEX IF NOT EXISTS idx_leads_processing_status ON public.leads(processing_status) WHERE processing_status = 'pending';

-- 2. Modificações na tabela 'api_keys' para escopos e limites
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{leads:read,leads:update,analyses:write,statuses:update}'::text[],
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rate_limit_rpm integer DEFAULT 60;

-- 3. Tabela 'lead_analyses' para histórico de análises de IA
CREATE TABLE IF NOT EXISTS public.lead_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  model_used text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  opportunity_summary text,
  possible_pain text,
  approach_angle text,
  whatsapp_message text,
  instagram_message text,
  email_subject text,
  email_body text,
  follow_up_message text,
  status text NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review', 'approved', 'rejected')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.lead_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin select analyses" ON public.lead_analyses;
CREATE POLICY "Admin select analyses" ON public.lead_analyses FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin manage analyses" ON public.lead_analyses;
CREATE POLICY "Admin manage analyses" ON public.lead_analyses FOR ALL USING (public.is_admin(auth.uid()));

-- 4. Tabela 'api_logs' para auditoria
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  lead_id uuid,
  status_code integer NOT NULL,
  duration_ms integer,
  request_id uuid NOT NULL,
  error_code text,
  error_message text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin select logs" ON public.api_logs;
CREATE POLICY "Admin select logs" ON public.api_logs FOR SELECT USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_api_logs_rate_limit ON public.api_logs(api_key_id, created_at);

-- 5. Tabela 'api_idempotency_keys' para controle de idempotência
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  payload_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_idempotency_key UNIQUE (user_id, idempotency_key)
);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage idempotency" ON public.api_idempotency_keys;
CREATE POLICY "Admin manage idempotency" ON public.api_idempotency_keys FOR ALL USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON public.api_idempotency_keys(created_at);

-- 6. RPC para submeter análise externa (Validação de Lock e Escrita Transacional)
CREATE OR REPLACE FUNCTION public.submit_external_lead_analysis(
  p_lead_id uuid,
  p_user_id uuid,
  p_api_key_id uuid,
  p_agent_name text,
  p_model_used text,
  p_priority text,
  p_opportunity_summary text,
  p_possible_pain text,
  p_approach_angle text,
  p_whatsapp_message text,
  p_instagram_message text,
  p_email_subject text,
  p_email_body text,
  p_follow_up_message text,
  p_metadata jsonb,
  p_lock_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analysis_id uuid;
  v_db_lock_token text;
  v_expires_at timestamptz;
  v_agent_id uuid;
BEGIN
  -- Obter o lock atual do lead
  SELECT processing_lock_token, processing_expires_at, processing_agent_id
  INTO v_db_lock_token, v_expires_at, v_agent_id
  FROM public.leads
  WHERE id = p_lead_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND' USING DETAIL = 'Lead não encontrado para este usuário.';
  END IF;

  -- Validar o Lock
  IF v_db_lock_token IS NULL OR v_db_lock_token <> p_lock_token THEN
    RAISE EXCEPTION 'INVALID_LOCK_TOKEN' USING DETAIL = 'Token de lock inválido ou ausente.';
  END IF;

  IF v_expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED_LOCK' USING DETAIL = 'O tempo de reserva do lead expirou (limite de 15 minutos).';
  END IF;

  IF v_agent_id <> p_api_key_id THEN
    RAISE EXCEPTION 'PROCESSING_CONFLICT' USING DETAIL = 'O agente que enviou a análise não é o mesmo que reservou o lead.';
  END IF;

  -- Inserir análise no histórico
  INSERT INTO public.lead_analyses (
    lead_id, user_id, api_key_id, agent_name, model_used, priority, 
    opportunity_summary, possible_pain, approach_angle, 
    whatsapp_message, instagram_message, email_subject, email_body, 
    follow_up_message, status, metadata
  ) VALUES (
    p_lead_id, p_user_id, p_api_key_id, p_agent_name, p_model_used, p_priority,
    p_opportunity_summary, p_possible_pain, p_approach_angle,
    p_whatsapp_message, p_instagram_message, p_email_subject, p_email_body,
    p_follow_up_message, 'awaiting_review', p_metadata
  )
  RETURNING id INTO v_analysis_id;

  -- Atualizar o lead operacionalmente
  UPDATE public.leads
  SET processing_status = 'awaiting_review',
      last_processing_at = now(),
      last_processing_error = NULL
  WHERE id = p_lead_id;

  RETURN v_analysis_id;
END;
$$;

-- Restringir execução da RPC a administradores ou service_role
REVOKE EXECUTE ON FUNCTION public.submit_external_lead_analysis FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_external_lead_analysis FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_external_lead_analysis FROM anon;

-- 7. RPC para aprovar a análise externa pelo administrador
CREATE OR REPLACE FUNCTION public.approve_external_lead_analysis(
  p_lead_id uuid,
  p_analysis_id uuid,
  p_admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analysis record;
  v_plano_json jsonb;
BEGIN
  -- Validar se o usuário executor é admin
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_REQUIRED' USING DETAIL = 'Acesso negado: Administrador requerido.';
  END IF;

  -- Carregar a análise específica
  SELECT * INTO v_analysis
  FROM public.lead_analyses
  WHERE id = p_analysis_id AND lead_id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANALYSIS_NOT_FOUND' USING DETAIL = 'Análise não encontrada.';
  END IF;

  -- Formatar o plano de prospecção para o formato de array padrão
  v_plano_json := jsonb_build_array(
    jsonb_build_object('dia', 1, 'canal', 'whatsapp', 'titulo', 'Abordagem WhatsApp', 'mensagem', v_analysis.whatsapp_message),
    jsonb_build_object('dia', 2, 'canal', 'instagram', 'titulo', 'Abordagem Instagram', 'mensagem', v_analysis.instagram_message),
    jsonb_build_object('dia', 3, 'canal', 'email', 'titulo', v_analysis.email_subject, 'mensagem', v_analysis.email_body),
    jsonb_build_object('dia', 4, 'canal', 'whatsapp', 'titulo', 'Follow-up WhatsApp', 'mensagem', v_analysis.follow_up_message)
  );

  -- Atualizar a análise
  UPDATE public.lead_analyses
  SET status = 'approved'
  WHERE id = p_analysis_id;

  -- Copiar dados de prospecção para o lead correspondente
  UPDATE public.leads
  SET plano_prospeccao = v_plano_json,
      diagnostico_bullets = array_to_json(ARRAY[v_analysis.opportunity_summary, v_analysis.possible_pain, v_analysis.approach_angle])::jsonb,
      probabilidade_conversao = CASE WHEN v_analysis.priority = 'high' THEN 85 WHEN v_analysis.priority = 'medium' THEN 60 ELSE 35 END,
      processing_status = 'approved',
      approved_at = now(),
      approved_by = p_admin_id,
      analysis_id = p_analysis_id,
      ai_analise_gerada_em = now(),
      status = 'em_contato' -- Atualização do crm comercial
  WHERE id = p_lead_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_external_lead_analysis FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_external_lead_analysis FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_external_lead_analysis FROM anon;

-- 8. RPC para rejeitar a análise externa pelo administrador
CREATE OR REPLACE FUNCTION public.reject_external_lead_analysis(
  p_lead_id uuid,
  p_analysis_id uuid,
  p_admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar se o usuário executor é admin
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_REQUIRED' USING DETAIL = 'Acesso negado: Administrador requerido.';
  END IF;

  -- Validar se a análise existe
  IF NOT EXISTS (SELECT 1 FROM public.lead_analyses WHERE id = p_analysis_id AND lead_id = p_lead_id) THEN
    RAISE EXCEPTION 'ANALYSIS_NOT_FOUND' USING DETAIL = 'Análise não encontrada.';
  END IF;

  -- Atualizar a análise para rejeitada
  UPDATE public.lead_analyses
  SET status = 'rejected'
  WHERE id = p_analysis_id;

  -- Atualizar o lead operacional
  UPDATE public.leads
  SET processing_status = 'rejected'
  WHERE id = p_lead_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_external_lead_analysis FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_external_lead_analysis FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_external_lead_analysis FROM anon;
