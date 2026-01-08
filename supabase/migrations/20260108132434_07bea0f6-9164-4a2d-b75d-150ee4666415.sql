-- Drop the existing function first
DROP FUNCTION IF EXISTS public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid, uuid);

-- Recreate with correct decrypt_sensitive calls (without ::text cast)
CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_leads_filtered(
  p_encryption_key text,
  p_salvo boolean DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_search_run_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  email text,
  website text,
  instagram_url text,
  instagram_context text,
  endereco text,
  whatsapp_number text,
  cnpj_telefone text,
  cnpj_email text,
  cidade text,
  nicho text,
  foco text,
  google_place_id text,
  rating numeric,
  total_reviews integer,
  whatsapp_on_site boolean,
  has_meta_pixel boolean,
  has_gtag boolean,
  has_gtm boolean,
  digital_signals jsonb,
  diagnostico_bullets jsonb,
  probabilidade_conversao integer,
  plano_prospeccao jsonb,
  ai_analise_gerada_em timestamp with time zone,
  status text,
  notas text,
  salvo boolean,
  proximidade_ativa boolean,
  raio_km numeric,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_id uuid,
  cnpj text,
  razao_social text,
  nome_responsavel text,
  situacao_cadastral text,
  porte_empresa text,
  cnae_principal text,
  pais text,
  search_run_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set encryption key for this session
  PERFORM set_config('app.encryption_key', p_encryption_key, true);
  
  RETURN QUERY
  SELECT 
    l.id,
    l.nome,
    CASE WHEN l.telefone_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.telefone_encrypted)
      ELSE NULL 
    END AS telefone,
    CASE WHEN l.email_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.email_encrypted)
      ELSE NULL 
    END AS email,
    CASE WHEN l.website_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.website_encrypted)
      ELSE NULL 
    END AS website,
    CASE WHEN l.instagram_url_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.instagram_url_encrypted)
      ELSE NULL 
    END AS instagram_url,
    l.instagram_context,
    CASE WHEN l.endereco_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.endereco_encrypted)
      ELSE NULL 
    END AS endereco,
    CASE WHEN l.whatsapp_number_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.whatsapp_number_encrypted)
      ELSE NULL 
    END AS whatsapp_number,
    CASE WHEN l.cnpj_telefone_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.cnpj_telefone_encrypted)
      ELSE NULL 
    END AS cnpj_telefone,
    CASE WHEN l.cnpj_email_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.cnpj_email_encrypted)
      ELSE NULL 
    END AS cnpj_email,
    l.cidade,
    l.nicho,
    l.foco,
    l.google_place_id,
    l.rating,
    l.total_reviews,
    l.whatsapp_on_site,
    l.has_meta_pixel,
    l.has_gtag,
    l.has_gtm,
    l.digital_signals,
    l.diagnostico_bullets,
    l.probabilidade_conversao,
    l.plano_prospeccao,
    l.ai_analise_gerada_em,
    l.status,
    l.notas,
    l.salvo,
    l.proximidade_ativa,
    l.raio_km,
    l.latitude,
    l.longitude,
    l.created_at,
    l.updated_at,
    l.user_id,
    l.cnpj,
    l.razao_social,
    l.nome_responsavel,
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal,
    l.pais,
    l.search_run_id
  FROM leads l
  WHERE 
    (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_salvo IS NULL OR l.salvo = p_salvo)
    AND (p_search_run_id IS NULL OR l.search_run_id = p_search_run_id)
  ORDER BY l.created_at DESC;
END;
$$;