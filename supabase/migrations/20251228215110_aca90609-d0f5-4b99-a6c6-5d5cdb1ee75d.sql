-- Script para verificar e corrigir inconsistências de leads_used_this_month
-- Primeiro, vamos criar uma função para auditoria e correção

-- Criar tabela de auditoria para registrar correções
CREATE TABLE IF NOT EXISTS public.leads_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  old_leads_used integer NOT NULL,
  new_leads_used integer NOT NULL,
  leads_count_in_period integer NOT NULL,
  billing_period_start timestamp with time zone,
  billing_period_end timestamp with time zone,
  corrected_at timestamp with time zone DEFAULT now(),
  correction_reason text
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.leads_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver a auditoria
CREATE POLICY "Admins can view audit logs" ON public.leads_audit_log
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Criar função para verificar e corrigir inconsistências
CREATE OR REPLACE FUNCTION public.fix_leads_count_inconsistencies()
RETURNS TABLE(
  user_id uuid,
  user_email text,
  old_leads_used integer,
  actual_leads_count integer,
  was_corrected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_actual_count integer;
  v_user_email text;
BEGIN
  -- Iterar sobre todas as assinaturas
  FOR r IN 
    SELECT 
      us.user_id,
      us.leads_used_this_month,
      us.billing_period_start,
      us.billing_period_end
    FROM public.user_subscriptions us
  LOOP
    -- Contar leads criados no período de billing atual
    SELECT COUNT(*) INTO v_actual_count
    FROM public.leads l
    WHERE l.user_id = r.user_id
      AND l.created_at >= r.billing_period_start
      AND l.created_at < r.billing_period_end;
    
    -- Buscar email do usuário
    SELECT au.email INTO v_user_email
    FROM auth.users au
    WHERE au.id = r.user_id;
    
    -- Se há inconsistência, corrigir
    IF r.leads_used_this_month != v_actual_count THEN
      -- Registrar na auditoria
      INSERT INTO public.leads_audit_log (
        user_id, 
        user_email,
        old_leads_used, 
        new_leads_used, 
        leads_count_in_period,
        billing_period_start,
        billing_period_end,
        correction_reason
      ) VALUES (
        r.user_id,
        v_user_email,
        r.leads_used_this_month,
        v_actual_count,
        v_actual_count,
        r.billing_period_start,
        r.billing_period_end,
        'Correção automática de inconsistência'
      );
      
      -- Corrigir o valor
      UPDATE public.user_subscriptions
      SET leads_used_this_month = v_actual_count,
          updated_at = now()
      WHERE user_subscriptions.user_id = r.user_id;
      
      -- Retornar registro corrigido
      user_id := r.user_id;
      user_email := v_user_email;
      old_leads_used := r.leads_used_this_month;
      actual_leads_count := v_actual_count;
      was_corrected := true;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Criar função somente para verificar (sem corrigir)
CREATE OR REPLACE FUNCTION public.check_leads_count_inconsistencies()
RETURNS TABLE(
  user_id uuid,
  user_email text,
  leads_used_this_month integer,
  actual_leads_count integer,
  difference integer,
  billing_period_start timestamp with time zone,
  billing_period_end timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_actual_count integer;
  v_user_email text;
BEGIN
  FOR r IN 
    SELECT 
      us.user_id,
      us.leads_used_this_month,
      us.billing_period_start,
      us.billing_period_end
    FROM public.user_subscriptions us
  LOOP
    SELECT COUNT(*) INTO v_actual_count
    FROM public.leads l
    WHERE l.user_id = r.user_id
      AND l.created_at >= r.billing_period_start
      AND l.created_at < r.billing_period_end;
    
    SELECT au.email INTO v_user_email
    FROM auth.users au
    WHERE au.id = r.user_id;
    
    -- Retornar apenas se há inconsistência
    IF r.leads_used_this_month != v_actual_count THEN
      user_id := r.user_id;
      user_email := v_user_email;
      leads_used_this_month := r.leads_used_this_month;
      actual_leads_count := v_actual_count;
      difference := r.leads_used_this_month - v_actual_count;
      billing_period_start := r.billing_period_start;
      billing_period_end := r.billing_period_end;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Executar a verificação e correção agora
SELECT * FROM public.fix_leads_count_inconsistencies();