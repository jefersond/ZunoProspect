-- ============================================
-- ENCRYPTION KEY HARDENING MIGRATION
-- Moves encryption key management OUTSIDE the database
-- Key is now passed via session-local GUC from Edge Functions only
-- ============================================

-- 1. Add encryption_key_version column for key rotation support
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS encryption_key_version smallint DEFAULT 1;
COMMENT ON COLUMN public.leads.encryption_key_version IS 'Version of the encryption key used. Supports key rotation.';

-- 2. Create index for efficient re-encryption queries by key version
CREATE INDEX IF NOT EXISTS idx_leads_encryption_key_version ON public.leads(encryption_key_version);

-- 3. Update encrypt_sensitive to use session-local GUC instead of private.get_encryption_key()
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get key from session-local GUC (set by Edge Function)
  encryption_key := current_setting('app.leads_key', true);
  
  -- CRITICAL: Fail safely if key is not set
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.leads_key via SET LOCAL before calling.' 
      USING ERRCODE = 'P0500';
  END IF;
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

COMMENT ON FUNCTION public.encrypt_sensitive(text) IS 
'Encrypts sensitive data using key from session GUC (app.leads_key). Key MUST be set via Edge Function using SET LOCAL before calling.';

-- 4. Update decrypt_sensitive to use session-local GUC
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get key from session-local GUC (set by Edge Function)
  encryption_key := current_setting('app.leads_key', true);
  
  -- CRITICAL: Fail safely if key is not set
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Decryption key not configured. Set app.leads_key via SET LOCAL before calling.' 
      USING ERRCODE = 'P0500';
  END IF;
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return NULL for graceful handling
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.decrypt_sensitive(bytea) IS 
'Decrypts sensitive data using key from session GUC (app.leads_key). Key MUST be set via Edge Function using SET LOCAL before calling.';

-- 5. Drop the private.get_encryption_key function (key no longer stored in DB)
-- First check if it exists before dropping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'private' 
    AND routine_name = 'get_encryption_key'
  ) THEN
    DROP FUNCTION private.get_encryption_key();
    RAISE NOTICE 'Dropped private.get_encryption_key() - key now managed externally';
  END IF;
END
$$;

-- 6. Revoke EXECUTE on encrypt/decrypt from public roles
-- These should only be called by SECURITY DEFINER functions that set the key
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive(bytea) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive(bytea) FROM anon;

-- 7. Create wrapper function for Edge Functions to set key and call operations
-- This is called by Edge Functions with service_role to set the key securely

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_leads_filtered(
  p_encryption_key text,
  p_salvo boolean DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  nome text,
  cidade text,
  nicho text,
  foco text,
  status text,
  notas text,
  rating numeric,
  total_reviews integer,
  latitude numeric,
  longitude numeric,
  google_place_id text,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
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
  nome_responsavel text,
  cnpj text,
  razao_social text,
  situacao_cadastral text,
  porte_empresa text,
  cnae_principal text,
  telefone text,
  email text,
  endereco text,
  whatsapp_number text,
  website text,
  instagram_url text,
  cnpj_telefone text,
  cnpj_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate key is provided
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key is required' USING ERRCODE = 'P0500';
  END IF;
  
  -- Set the key for this transaction only
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Call the existing filtered function
  RETURN QUERY SELECT * FROM public.get_leads_decrypted_filtered(p_salvo, p_user_id);
END;
$$;

-- Restrict to service_role only
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid) FROM anon;

COMMENT ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, boolean, uuid) IS 
'Wrapper for Edge Functions. Sets encryption key from external secret and returns filtered leads. Restricted to service_role.';

-- 8. Create wrapper for getting single lead by ID
CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_lead_by_id(
  p_encryption_key text,
  p_lead_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  google_place_id text,
  nome text,
  telefone text,
  email text,
  endereco text,
  whatsapp_number text,
  website text,
  instagram_url text,
  cidade text,
  nicho text,
  foco text,
  status text,
  notas text,
  rating numeric,
  total_reviews integer,
  latitude numeric,
  longitude numeric,
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
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  cnpj text,
  razao_social text,
  nome_responsavel text,
  cnpj_telefone text,
  cnpj_email text,
  situacao_cadastral text,
  porte_empresa text,
  cnae_principal text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate key is provided
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key is required' USING ERRCODE = 'P0500';
  END IF;
  
  -- Set the key for this transaction only
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Call the existing function
  RETURN QUERY SELECT * FROM public.get_lead_decrypted_by_id(p_lead_id, p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_by_id(text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_by_id(text, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_by_id(text, uuid, uuid) FROM anon;

COMMENT ON FUNCTION public.set_encryption_key_and_get_lead_by_id(text, uuid, uuid) IS 
'Wrapper for Edge Functions. Sets encryption key and returns single lead. Restricted to service_role.';

-- 9. Create wrapper for sensitive fields access
CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_lead_sensitive(
  p_encryption_key text,
  p_lead_id uuid,
  p_fields text[] DEFAULT ARRAY['telefone', 'email', 'whatsapp_number', 'website', 'instagram_url', 'endereco', 'cnpj_telefone', 'cnpj_email']
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate key is provided
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key is required' USING ERRCODE = 'P0500';
  END IF;
  
  -- Set the key for this transaction only
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Call the existing function
  RETURN public.get_lead_sensitive(p_lead_id, p_fields);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_sensitive(text, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_sensitive(text, uuid, text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_get_lead_sensitive(text, uuid, text[]) FROM anon;

COMMENT ON FUNCTION public.set_encryption_key_and_get_lead_sensitive(text, uuid, text[]) IS 
'Wrapper for Edge Functions. Sets encryption key and returns sensitive fields. Restricted to service_role.';

-- 10. Create wrapper for insert with encryption
CREATE OR REPLACE FUNCTION public.set_encryption_key_and_insert_lead(
  p_encryption_key text,
  p_nome text,
  p_endereco text,
  p_telefone text,
  p_website text,
  p_google_place_id text,
  p_rating numeric,
  p_total_reviews integer,
  p_cidade text,
  p_latitude numeric,
  p_longitude numeric,
  p_nicho text,
  p_foco text,
  p_user_id uuid,
  p_proximidade_ativa boolean,
  p_raio_km integer,
  p_whatsapp_on_site boolean,
  p_whatsapp_number text,
  p_has_meta_pixel boolean,
  p_has_gtag boolean,
  p_has_gtm boolean,
  p_instagram_url text,
  p_digital_signals jsonb,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT 'BR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate key is provided
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key is required' USING ERRCODE = 'P0500';
  END IF;
  
  -- Set the key for this transaction only
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Call the existing insert function
  RETURN public.insert_lead_with_encryption_v2(
    p_nome, p_endereco, p_telefone, p_website, p_google_place_id,
    p_rating, p_total_reviews, p_cidade, p_latitude, p_longitude,
    p_nicho, p_foco, p_user_id, p_proximidade_ativa, p_raio_km,
    p_whatsapp_on_site, p_whatsapp_number, p_has_meta_pixel,
    p_has_gtag, p_has_gtm, p_instagram_url, p_digital_signals,
    p_email, p_pais
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, text, text, text, numeric, integer, text, numeric, numeric,
  text, text, uuid, boolean, integer, boolean, text, boolean, boolean, boolean,
  text, jsonb, text, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, text, text, text, numeric, integer, text, numeric, numeric,
  text, text, uuid, boolean, integer, boolean, text, boolean, boolean, boolean,
  text, jsonb, text, text
) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, text, text, text, numeric, integer, text, numeric, numeric,
  text, text, uuid, boolean, integer, boolean, text, boolean, boolean, boolean,
  text, jsonb, text, text
) FROM anon;

COMMENT ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, text, text, text, numeric, integer, text, numeric, numeric,
  text, text, uuid, boolean, integer, boolean, text, boolean, boolean, boolean,
  text, jsonb, text, text
) IS 'Wrapper for Edge Functions. Sets encryption key and inserts lead. Restricted to service_role.';