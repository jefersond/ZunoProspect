-- RPCs required by get-leads-secure and analisar-lead-ia in the new Supabase project.

CREATE TABLE IF NOT EXISTS public.leads_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  lead_ids uuid[],
  leads_count integer NOT NULL DEFAULT 0,
  ip_address text,
  user_agent text,
  request_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leads access logs" ON public.leads_access_logs;
CREATE POLICY "Users can view own leads access logs"
ON public.leads_access_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_leads_rate_limit(
  p_user_id uuid,
  p_max_requests integer DEFAULT 30,
  p_window_minutes integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_allowed boolean;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.leads_access_logs
  WHERE user_id = p_user_id
    AND action_type IN ('list', 'export')
    AND created_at >= now() - make_interval(mins => p_window_minutes);

  v_allowed := v_count < p_max_requests OR public.is_admin(p_user_id);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_count,
    'limit', p_max_requests,
    'remaining', CASE WHEN public.is_admin(p_user_id) THEN p_max_requests ELSE GREATEST(p_max_requests - v_count, 0) END,
    'reset_in_minutes', p_window_minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_leads_access(
  p_user_id uuid,
  p_action_type text,
  p_lead_ids uuid[] DEFAULT NULL,
  p_leads_count integer DEFAULT 0,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_request_params jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leads_access_logs (
    user_id,
    action_type,
    lead_ids,
    leads_count,
    ip_address,
    user_agent,
    request_params
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_lead_ids,
    COALESCE(p_leads_count, 0),
    p_ip_address,
    p_user_agent,
    COALESCE(p_request_params, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lead_decrypted_by_id(
  p_lead_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nome text,
  endereco text,
  telefone text,
  email text,
  website text,
  google_place_id text,
  rating numeric,
  total_reviews integer,
  cidade text,
  latitude numeric,
  longitude numeric,
  nicho text,
  foco text,
  status text,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  pais text,
  whatsapp_number text,
  instagram_url text,
  whatsapp_on_site boolean,
  has_meta_pixel boolean,
  has_gtag boolean,
  has_gtm boolean,
  digital_signals jsonb,
  diagnostico_bullets jsonb,
  probabilidade_conversao integer,
  plano_prospeccao jsonb,
  ai_analise_gerada_em timestamptz,
  proximidade_ativa boolean,
  raio_km integer,
  salvo boolean,
  instagram_context text,
  cnpj text,
  razao_social text,
  nome_responsavel text,
  cnpj_telefone text,
  cnpj_email text,
  situacao_cadastral text,
  porte_empresa text,
  cnae_principal text,
  search_run_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.user_id,
    l.nome,
    l.endereco,
    COALESCE(public.decrypt_sensitive(l.telefone_encrypted), l.telefone),
    COALESCE(public.decrypt_sensitive(l.email_encrypted), l.email),
    COALESCE(public.decrypt_sensitive(l.website_encrypted), l.website),
    l.google_place_id,
    l.rating,
    l.total_reviews,
    l.cidade,
    l.latitude,
    l.longitude,
    l.nicho,
    l.foco,
    l.status,
    l.notas,
    l.created_at,
    l.updated_at,
    l.pais,
    COALESCE(public.decrypt_sensitive(l.whatsapp_number_encrypted), l.whatsapp_number),
    COALESCE(public.decrypt_sensitive(l.instagram_url_encrypted), l.instagram_url),
    l.whatsapp_on_site,
    l.has_meta_pixel,
    l.has_gtag,
    l.has_gtm,
    l.digital_signals,
    l.diagnostico_bullets,
    l.probabilidade_conversao,
    l.plano_prospeccao,
    l.ai_analise_gerada_em,
    l.proximidade_ativa,
    l.raio_km,
    l.salvo,
    l.instagram_context,
    l.cnpj,
    l.razao_social,
    l.nome_responsavel,
    COALESCE(public.decrypt_sensitive(l.cnpj_telefone_encrypted), l.cnpj_telefone),
    COALESCE(public.decrypt_sensitive(l.cnpj_email_encrypted), l.cnpj_email),
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal,
    l.search_run_id
  FROM public.leads l
  WHERE l.id = p_lead_id
    AND (l.user_id = p_user_id OR public.is_admin(p_user_id));
$$;

GRANT EXECUTE ON FUNCTION public.check_leads_rate_limit(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_leads_access(uuid, text, uuid[], integer, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_lead_decrypted_by_id(uuid, uuid) TO authenticated, service_role;
