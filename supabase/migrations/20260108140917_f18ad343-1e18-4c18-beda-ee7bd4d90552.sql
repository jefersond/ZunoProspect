
-- Fix the encryption key variable name to match what encrypt_sensitive/decrypt_sensitive expect
-- They use 'app.leads_key' but set_encryption_key_and_get_leads_filtered was setting 'app.encryption_key'

-- Drop and recreate set_encryption_key_and_get_leads_filtered with correct key variable
DROP FUNCTION IF EXISTS public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid, uuid);

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
  raio_km integer,
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
  -- Set encryption key using the correct variable name that decrypt_sensitive expects
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
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

-- Also fix set_encryption_key_and_insert_lead to use app.leads_key
-- First check what versions exist
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, jsonb, text, text, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, text, boolean, numeric, numeric, integer, uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_insert_lead(
  p_encryption_key text,
  p_nome text,
  p_digital_signals jsonb,
  p_cidade text,
  p_email text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_foco text DEFAULT NULL,
  p_google_place_id text DEFAULT NULL,
  p_has_gtag boolean DEFAULT false,
  p_has_gtm boolean DEFAULT false,
  p_has_meta_pixel boolean DEFAULT false,
  p_instagram_url text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_nicho text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_proximidade_ativa boolean DEFAULT false,
  p_raio_km numeric DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_total_reviews integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_whatsapp_on_site boolean DEFAULT false,
  p_search_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_user_id uuid;
BEGIN
  -- Set encryption key using the correct variable name
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Use provided user_id or get from auth context
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  -- Insert the lead with encrypted fields
  INSERT INTO leads (
    nome,
    cidade,
    nicho,
    foco,
    google_place_id,
    rating,
    total_reviews,
    whatsapp_on_site,
    has_meta_pixel,
    has_gtag,
    has_gtm,
    digital_signals,
    proximidade_ativa,
    raio_km,
    latitude,
    longitude,
    user_id,
    pais,
    search_run_id,
    telefone_encrypted,
    email_encrypted,
    website_encrypted,
    instagram_url_encrypted,
    endereco_encrypted,
    whatsapp_number_encrypted
  ) VALUES (
    p_nome,
    p_cidade,
    COALESCE(p_nicho, ''),
    COALESCE(p_foco, ''),
    p_google_place_id,
    p_rating,
    p_total_reviews,
    COALESCE(p_whatsapp_on_site, false),
    COALESCE(p_has_meta_pixel, false),
    COALESCE(p_has_gtag, false),
    COALESCE(p_has_gtm, false),
    COALESCE(p_digital_signals, '{}'::jsonb),
    COALESCE(p_proximidade_ativa, false),
    p_raio_km::integer,
    p_latitude,
    p_longitude,
    v_user_id,
    p_pais,
    p_search_run_id,
    CASE WHEN p_telefone IS NOT NULL AND p_telefone != '' THEN encrypt_sensitive(p_telefone) ELSE NULL END,
    CASE WHEN p_email IS NOT NULL AND p_email != '' THEN encrypt_sensitive(p_email) ELSE NULL END,
    CASE WHEN p_website IS NOT NULL AND p_website != '' THEN encrypt_sensitive(p_website) ELSE NULL END,
    CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url != '' THEN encrypt_sensitive(p_instagram_url) ELSE NULL END,
    CASE WHEN p_endereco IS NOT NULL AND p_endereco != '' THEN encrypt_sensitive(p_endereco) ELSE NULL END,
    CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number != '' THEN encrypt_sensitive(p_whatsapp_number) ELSE NULL END
  )
  RETURNING id INTO v_lead_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'is_new', true
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Lead already exists, find and return it
    SELECT id INTO v_lead_id
    FROM leads
    WHERE google_place_id = p_google_place_id
      AND user_id = v_user_id
    LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true,
      'lead_id', v_lead_id,
      'is_new', false
    );
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Fix set_encryption_key_and_get_lead_by_id as well
DROP FUNCTION IF EXISTS public.set_encryption_key_and_get_lead_by_id(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_lead_by_id(
  p_encryption_key text,
  p_lead_id uuid,
  p_user_id uuid DEFAULT NULL
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
  raio_km integer,
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
  pais text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set encryption key using the correct variable name
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
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
    l.pais
  FROM leads l
  WHERE 
    l.id = p_lead_id
    AND (p_user_id IS NULL OR l.user_id = p_user_id);
END;
$$;
