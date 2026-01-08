-- Add search_run_id column to identify leads from the same search session
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS search_run_id uuid;

-- Create index for efficient filtering by search_run_id
CREATE INDEX IF NOT EXISTS idx_leads_search_run_id ON public.leads(search_run_id);

-- Add parameter to existing RPC function to filter by search_run_id
-- First, drop and recreate set_encryption_key_and_get_leads_filtered to accept search_run_id
DROP FUNCTION IF EXISTS public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid);

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
  ai_analise_gerada_em timestamptz,
  status text,
  notas text,
  salvo boolean,
  proximidade_ativa boolean,
  raio_km integer,
  latitude numeric,
  longitude numeric,
  created_at timestamptz,
  updated_at timestamptz,
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
      THEN decrypt_sensitive(l.telefone_encrypted::text)
      ELSE NULL 
    END AS telefone,
    CASE WHEN l.email_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.email_encrypted::text)
      ELSE NULL 
    END AS email,
    CASE WHEN l.website_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.website_encrypted::text)
      ELSE NULL 
    END AS website,
    CASE WHEN l.instagram_url_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.instagram_url_encrypted::text)
      ELSE NULL 
    END AS instagram_url,
    l.instagram_context,
    CASE WHEN l.endereco_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.endereco_encrypted::text)
      ELSE NULL 
    END AS endereco,
    CASE WHEN l.whatsapp_number_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.whatsapp_number_encrypted::text)
      ELSE NULL 
    END AS whatsapp_number,
    CASE WHEN l.cnpj_telefone_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.cnpj_telefone_encrypted::text)
      ELSE NULL 
    END AS cnpj_telefone,
    CASE WHEN l.cnpj_email_encrypted IS NOT NULL 
      THEN decrypt_sensitive(l.cnpj_email_encrypted::text)
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

-- Update insert function to accept search_run_id
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, text, jsonb, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, boolean, integer, numeric, integer, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_insert_lead(
  p_encryption_key text,
  p_nome text,
  p_cidade text,
  p_digital_signals jsonb,
  p_email text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_foco text DEFAULT NULL,
  p_has_gtag boolean DEFAULT false,
  p_has_gtm boolean DEFAULT false,
  p_has_meta_pixel boolean DEFAULT false,
  p_instagram_url text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_nicho text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_proximidade_ativa boolean DEFAULT false,
  p_raio_km integer DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_total_reviews integer DEFAULT NULL,
  p_user_id text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_whatsapp_on_site boolean DEFAULT false,
  p_whatsapp_number text DEFAULT NULL,
  p_google_place_id text DEFAULT NULL,
  p_pais text DEFAULT 'BR',
  p_search_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_is_new boolean := true;
BEGIN
  -- Set encryption key for this session
  PERFORM set_config('app.encryption_key', p_encryption_key, true);
  
  -- Check if lead already exists by google_place_id for this user
  IF p_google_place_id IS NOT NULL THEN
    SELECT id INTO v_lead_id 
    FROM leads 
    WHERE google_place_id = p_google_place_id 
      AND user_id = p_user_id::uuid;
    
    IF v_lead_id IS NOT NULL THEN
      v_is_new := false;
      
      -- Update existing lead
      UPDATE leads SET
        nome = p_nome,
        cidade = p_cidade,
        nicho = COALESCE(p_nicho, nicho),
        foco = COALESCE(p_foco, foco),
        rating = COALESCE(p_rating, rating),
        total_reviews = COALESCE(p_total_reviews, total_reviews),
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        proximidade_ativa = p_proximidade_ativa,
        raio_km = COALESCE(p_raio_km, raio_km),
        whatsapp_on_site = p_whatsapp_on_site,
        has_meta_pixel = p_has_meta_pixel,
        has_gtag = p_has_gtag,
        has_gtm = p_has_gtm,
        digital_signals = COALESCE(p_digital_signals, digital_signals),
        pais = COALESCE(p_pais, pais),
        search_run_id = COALESCE(p_search_run_id, search_run_id),
        telefone_encrypted = CASE WHEN p_telefone IS NOT NULL THEN encrypt_sensitive(p_telefone)::bytea ELSE telefone_encrypted END,
        email_encrypted = CASE WHEN p_email IS NOT NULL THEN encrypt_sensitive(p_email)::bytea ELSE email_encrypted END,
        website_encrypted = CASE WHEN p_website IS NOT NULL THEN encrypt_sensitive(p_website)::bytea ELSE website_encrypted END,
        instagram_url_encrypted = CASE WHEN p_instagram_url IS NOT NULL THEN encrypt_sensitive(p_instagram_url)::bytea ELSE instagram_url_encrypted END,
        endereco_encrypted = CASE WHEN p_endereco IS NOT NULL THEN encrypt_sensitive(p_endereco)::bytea ELSE endereco_encrypted END,
        whatsapp_number_encrypted = CASE WHEN p_whatsapp_number IS NOT NULL THEN encrypt_sensitive(p_whatsapp_number)::bytea ELSE whatsapp_number_encrypted END,
        updated_at = now()
      WHERE id = v_lead_id;
      
      RETURN jsonb_build_object('id', v_lead_id, 'is_new', false);
    END IF;
  END IF;
  
  -- Insert new lead
  INSERT INTO leads (
    user_id,
    nome,
    cidade,
    nicho,
    foco,
    google_place_id,
    rating,
    total_reviews,
    latitude,
    longitude,
    proximidade_ativa,
    raio_km,
    whatsapp_on_site,
    has_meta_pixel,
    has_gtag,
    has_gtm,
    digital_signals,
    pais,
    search_run_id,
    telefone_encrypted,
    email_encrypted,
    website_encrypted,
    instagram_url_encrypted,
    endereco_encrypted,
    whatsapp_number_encrypted
  ) VALUES (
    p_user_id::uuid,
    p_nome,
    p_cidade,
    p_nicho,
    p_foco,
    p_google_place_id,
    p_rating,
    p_total_reviews,
    p_latitude,
    p_longitude,
    p_proximidade_ativa,
    p_raio_km,
    p_whatsapp_on_site,
    p_has_meta_pixel,
    p_has_gtag,
    p_has_gtm,
    p_digital_signals,
    p_pais,
    p_search_run_id,
    CASE WHEN p_telefone IS NOT NULL THEN encrypt_sensitive(p_telefone)::bytea ELSE NULL END,
    CASE WHEN p_email IS NOT NULL THEN encrypt_sensitive(p_email)::bytea ELSE NULL END,
    CASE WHEN p_website IS NOT NULL THEN encrypt_sensitive(p_website)::bytea ELSE NULL END,
    CASE WHEN p_instagram_url IS NOT NULL THEN encrypt_sensitive(p_instagram_url)::bytea ELSE NULL END,
    CASE WHEN p_endereco IS NOT NULL THEN encrypt_sensitive(p_endereco)::bytea ELSE NULL END,
    CASE WHEN p_whatsapp_number IS NOT NULL THEN encrypt_sensitive(p_whatsapp_number)::bytea ELSE NULL END
  )
  RETURNING id INTO v_lead_id;
  
  RETURN jsonb_build_object('id', v_lead_id, 'is_new', true);
END;
$$;