-- =====================================================
-- FIX: Remove duplicate RPC functions and restore permissions
-- =====================================================

-- 1. Drop ALL existing versions of set_encryption_key_and_insert_lead
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, text, text, text, text, numeric, integer, text, numeric, numeric, text, text, uuid, boolean, integer, boolean, text, boolean, boolean, boolean, text, jsonb, text, text);

DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, text, jsonb, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, boolean, integer, numeric, integer, text, text, boolean, text, text, uuid);

DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, jsonb, text, text, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, text, boolean, numeric, numeric, integer, uuid, text, text, boolean, uuid);

-- Drop by name only to catch any remaining versions
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(text, text, text, jsonb, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, boolean, integer, numeric, integer, text, text, boolean, text, text, text);

-- 2. Recreate unified version with correct types
CREATE OR REPLACE FUNCTION public.set_encryption_key_and_insert_lead(
  p_encryption_key text,
  p_nome text,
  p_cidade text,
  p_digital_signals jsonb,
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
  p_pais text DEFAULT 'BR',
  p_proximidade_ativa boolean DEFAULT false,
  p_raio_km integer DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_total_reviews integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_whatsapp_on_site boolean DEFAULT false,
  p_telefone text DEFAULT NULL,
  p_search_run_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_user_id uuid;
BEGIN
  -- Set encryption key for this session
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  -- Use provided user_id or get from auth context
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Insert lead with encrypted fields
  INSERT INTO public.leads (
    nome,
    cidade,
    digital_signals,
    email_encrypted,
    endereco_encrypted,
    foco,
    google_place_id,
    has_gtag,
    has_gtm,
    has_meta_pixel,
    instagram_url_encrypted,
    latitude,
    longitude,
    nicho,
    pais,
    proximidade_ativa,
    raio_km,
    rating,
    total_reviews,
    user_id,
    website_encrypted,
    whatsapp_number_encrypted,
    whatsapp_on_site,
    telefone_encrypted,
    search_run_id
  ) VALUES (
    p_nome,
    p_cidade,
    p_digital_signals,
    CASE WHEN p_email IS NOT NULL AND p_email != '' THEN public.encrypt_sensitive(p_email) ELSE NULL END,
    CASE WHEN p_endereco IS NOT NULL AND p_endereco != '' THEN public.encrypt_sensitive(p_endereco) ELSE NULL END,
    p_foco,
    p_google_place_id,
    p_has_gtag,
    p_has_gtm,
    p_has_meta_pixel,
    CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url != '' THEN public.encrypt_sensitive(p_instagram_url) ELSE NULL END,
    p_latitude,
    p_longitude,
    p_nicho,
    p_pais,
    p_proximidade_ativa,
    p_raio_km,
    p_rating,
    p_total_reviews,
    v_user_id,
    CASE WHEN p_website IS NOT NULL AND p_website != '' THEN public.encrypt_sensitive(p_website) ELSE NULL END,
    CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number != '' THEN public.encrypt_sensitive(p_whatsapp_number) ELSE NULL END,
    p_whatsapp_on_site,
    CASE WHEN p_telefone IS NOT NULL AND p_telefone != '' THEN public.encrypt_sensitive(p_telefone) ELSE NULL END,
    p_search_run_id
  )
  RETURNING id INTO v_lead_id;
  
  RETURN json_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

-- 3. Restore SELECT permission for authenticated role (required for RLS to work)
GRANT SELECT ON public.leads TO authenticated;

-- 4. Ensure UPDATE permission for pipeline status changes
GRANT UPDATE ON public.leads TO authenticated;