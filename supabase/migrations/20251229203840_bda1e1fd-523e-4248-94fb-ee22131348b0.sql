-- ================================================================
-- MIGRATION: Controle de Acesso por Coluna para Dados Sensíveis
-- ================================================================
-- Este migration implementa camadas extras de segurança:
-- 1. REVOKE de SELECT nas colunas sensíveis para anon/authenticated
-- 2. VIEW segura (leads_safe) para listagem
-- 3. RPC controlado para leitura de dados sensíveis
-- ================================================================

-- ================================================================
-- PASSO 1: Revogar acesso amplo e conceder apenas colunas não sensíveis
-- ================================================================

-- Revoke SELECT amplo na tabela leads para roles públicos
REVOKE SELECT ON public.leads FROM anon;
REVOKE SELECT ON public.leads FROM authenticated;

-- Grant SELECT apenas nas colunas NÃO sensíveis para authenticated
-- (colunas necessárias para listagem básica)
GRANT SELECT (
  id,
  user_id,
  nome,
  cidade,
  nicho,
  foco,
  status,
  rating,
  total_reviews,
  created_at,
  updated_at,
  whatsapp_on_site,
  has_meta_pixel,
  has_gtag,
  has_gtm,
  probabilidade_conversao,
  ai_analise_gerada_em,
  proximidade_ativa,
  raio_km,
  salvo,
  google_place_id,
  latitude,
  longitude,
  diagnostico_bullets,
  plano_prospeccao,
  digital_signals,
  nome_responsavel,
  porte_empresa,
  situacao_cadastral,
  pais
) ON public.leads TO authenticated;

-- Manter INSERT/UPDATE/DELETE funcionando para o dono do registro
-- (as políticas RLS existentes já controlam isso)
GRANT INSERT, UPDATE, DELETE ON public.leads TO authenticated;

-- ================================================================
-- PASSO 2: Criar VIEW segura para listagem (leads_safe)
-- ================================================================

-- Drop view se existir (para permitir recriação)
DROP VIEW IF EXISTS public.leads_safe;

-- Criar view com colunas não sensíveis e versões mascaradas
CREATE OR REPLACE VIEW public.leads_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  nome,
  cidade,
  nicho,
  foco,
  status,
  rating,
  total_reviews,
  created_at,
  updated_at,
  whatsapp_on_site,
  has_meta_pixel,
  has_gtag,
  has_gtm,
  probabilidade_conversao,
  ai_analise_gerada_em,
  proximidade_ativa,
  raio_km,
  salvo,
  google_place_id,
  latitude,
  longitude,
  diagnostico_bullets,
  plano_prospeccao,
  digital_signals,
  nome_responsavel,
  porte_empresa,
  situacao_cadastral,
  pais,
  notas,
  instagram_context,
  cnpj,
  razao_social,
  cnae_principal,
  -- Indicadores de presença de dados sensíveis (sem expor valores)
  CASE WHEN telefone_encrypted IS NOT NULL THEN true ELSE false END AS has_phone,
  CASE WHEN email_encrypted IS NOT NULL THEN true ELSE false END AS has_email,
  CASE WHEN website_encrypted IS NOT NULL THEN true ELSE false END AS has_website,
  CASE WHEN instagram_url_encrypted IS NOT NULL THEN true ELSE false END AS has_instagram,
  CASE WHEN whatsapp_number_encrypted IS NOT NULL THEN true ELSE false END AS has_whatsapp,
  CASE WHEN endereco_encrypted IS NOT NULL THEN true ELSE false END AS has_address,
  CASE WHEN cnpj_telefone_encrypted IS NOT NULL THEN true ELSE false END AS has_cnpj_phone,
  CASE WHEN cnpj_email_encrypted IS NOT NULL THEN true ELSE false END AS has_cnpj_email
FROM public.leads
WHERE user_id = auth.uid();

-- Conceder SELECT na view para authenticated
GRANT SELECT ON public.leads_safe TO authenticated;

-- ================================================================
-- PASSO 3: Criar RPC para leitura controlada de campos sensíveis
-- ================================================================

-- Função para obter APENAS campos sensíveis de um lead específico
-- Com verificação obrigatória de ownership ou admin
CREATE OR REPLACE FUNCTION public.get_lead_sensitive(
  p_lead_id uuid,
  p_fields text[] DEFAULT ARRAY['telefone', 'email', 'whatsapp_number', 'website', 'instagram_url', 'endereco', 'cnpj_telefone', 'cnpj_email']
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_lead_user_id uuid;
  v_is_admin boolean;
  v_result jsonb;
  v_allowed_fields text[] := ARRAY['telefone', 'email', 'whatsapp_number', 'website', 'instagram_url', 'endereco', 'cnpj_telefone', 'cnpj_email'];
  v_requested_fields text[];
BEGIN
  -- Obter ID do usuário autenticado
  v_user_id := auth.uid();
  
  -- Verificar se o usuário está autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = 'P0401';
  END IF;
  
  -- Verificar se o lead existe e pertence ao usuário
  SELECT user_id INTO v_lead_user_id
  FROM public.leads
  WHERE id = p_lead_id;
  
  IF v_lead_user_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE = 'P0404';
  END IF;
  
  -- Verificar ownership ou admin
  v_is_admin := public.is_admin(v_user_id);
  
  IF v_lead_user_id != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para acessar este lead' USING ERRCODE = 'P0403';
  END IF;
  
  -- Filtrar apenas campos permitidos (whitelist)
  SELECT array_agg(f)
  INTO v_requested_fields
  FROM unnest(p_fields) AS f
  WHERE f = ANY(v_allowed_fields);
  
  IF v_requested_fields IS NULL OR array_length(v_requested_fields, 1) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Construir resultado com campos solicitados
  v_result := '{}'::jsonb;
  
  -- Buscar e decriptar campos solicitados
  SELECT 
    CASE WHEN 'telefone' = ANY(v_requested_fields) THEN 
      jsonb_build_object('telefone', public.decrypt_sensitive(telefone_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'email' = ANY(v_requested_fields) THEN 
      jsonb_build_object('email', public.decrypt_sensitive(email_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'whatsapp_number' = ANY(v_requested_fields) THEN 
      jsonb_build_object('whatsapp_number', public.decrypt_sensitive(whatsapp_number_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'website' = ANY(v_requested_fields) THEN 
      jsonb_build_object('website', public.decrypt_sensitive(website_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'instagram_url' = ANY(v_requested_fields) THEN 
      jsonb_build_object('instagram_url', public.decrypt_sensitive(instagram_url_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'endereco' = ANY(v_requested_fields) THEN 
      jsonb_build_object('endereco', public.decrypt_sensitive(endereco_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'cnpj_telefone' = ANY(v_requested_fields) THEN 
      jsonb_build_object('cnpj_telefone', public.decrypt_sensitive(cnpj_telefone_encrypted))
    ELSE '{}'::jsonb END ||
    CASE WHEN 'cnpj_email' = ANY(v_requested_fields) THEN 
      jsonb_build_object('cnpj_email', public.decrypt_sensitive(cnpj_email_encrypted))
    ELSE '{}'::jsonb END
  INTO v_result
  FROM public.leads
  WHERE id = p_lead_id;
  
  -- Adicionar metadata
  v_result := v_result || jsonb_build_object(
    '_meta', jsonb_build_object(
      'lead_id', p_lead_id,
      'accessed_at', now(),
      'accessed_by', v_user_id
    )
  );
  
  RETURN v_result;
END;
$$;

-- Conceder EXECUTE para authenticated
GRANT EXECUTE ON FUNCTION public.get_lead_sensitive(uuid, text[]) TO authenticated;

-- ================================================================
-- PASSO 4: Criar função auxiliar para verificar acesso a campos sensíveis
-- ================================================================

-- Função para verificar se usuário pode acessar campos sensíveis de um lead
CREATE OR REPLACE FUNCTION public.can_access_lead_sensitive(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_lead_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT user_id INTO v_lead_user_id
  FROM public.leads
  WHERE id = p_lead_id;
  
  IF v_lead_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Dono do lead ou admin pode acessar
  RETURN v_lead_user_id = v_user_id OR public.is_admin(v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_lead_sensitive(uuid) TO authenticated;

-- ================================================================
-- COMENTÁRIOS DE TESTE
-- ================================================================
-- Para verificar que o controle de acesso está funcionando:
--
-- 1. TESTE: authenticated NÃO consegue SELECT em colunas sensíveis diretamente:
--    SELECT telefone_encrypted FROM public.leads; -- Deve dar erro de permissão
--    SELECT email_encrypted FROM public.leads; -- Deve dar erro de permissão
--
-- 2. TESTE: authenticated CONSEGUE SELECT em colunas não sensíveis:
--    SELECT id, nome, cidade, status FROM public.leads WHERE user_id = auth.uid(); -- OK
--
-- 3. TESTE: authenticated CONSEGUE usar a view segura:
--    SELECT * FROM public.leads_safe; -- OK, mostra apenas seus leads com has_* indicadores
--
-- 4. TESTE: authenticated CONSEGUE acessar dados sensíveis via RPC quando autorizado:
--    SELECT public.get_lead_sensitive('lead-id-aqui'::uuid); -- OK se dono
--    SELECT public.get_lead_sensitive('lead-id-aqui'::uuid, ARRAY['telefone', 'email']); -- OK, campos específicos
--
-- 5. TESTE: authenticated NÃO consegue acessar dados sensíveis de outro usuário:
--    SELECT public.get_lead_sensitive('lead-de-outro-usuario'::uuid); -- Erro P0403
-- ================================================================