-- Keep secure lead inserts compatible with remote projects that still have
-- the legacy public.leads.company_name NOT NULL column.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_name varchar;

UPDATE public.leads
SET company_name = COALESCE(company_name, nome, 'Empresa sem nome')
WHERE company_name IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN company_name SET DEFAULT 'Empresa sem nome',
  ALTER COLUMN company_name SET NOT NULL;

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
  v_is_new boolean := true;
  v_company_name text := COALESCE(NULLIF(trim(p_nome), ''), 'Empresa sem nome');
BEGIN
  PERFORM set_config('app.leads_key', COALESCE(p_encryption_key, ''), true);
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  IF p_google_place_id IS NOT NULL THEN
    SELECT id
    INTO v_lead_id
    FROM public.leads
    WHERE user_id = v_user_id
      AND google_place_id = p_google_place_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    v_is_new := false;

    UPDATE public.leads
    SET nome = COALESCE(p_nome, nome),
        company_name = COALESCE(v_company_name, company_name),
        cidade = COALESCE(p_cidade, cidade),
        digital_signals = COALESCE(p_digital_signals, digital_signals),
        email = COALESCE(p_email, email),
        email_encrypted = CASE WHEN p_email IS NOT NULL AND p_email <> '' THEN public.encrypt_sensitive(p_email) ELSE email_encrypted END,
        endereco = COALESCE(p_endereco, endereco),
        endereco_encrypted = CASE WHEN p_endereco IS NOT NULL AND p_endereco <> '' THEN public.encrypt_sensitive(p_endereco) ELSE endereco_encrypted END,
        foco = COALESCE(p_foco, foco),
        has_gtag = COALESCE(p_has_gtag, has_gtag),
        has_gtm = COALESCE(p_has_gtm, has_gtm),
        has_meta_pixel = COALESCE(p_has_meta_pixel, has_meta_pixel),
        instagram_url = COALESCE(p_instagram_url, instagram_url),
        instagram_url_encrypted = CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url <> '' THEN public.encrypt_sensitive(p_instagram_url) ELSE instagram_url_encrypted END,
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        nicho = COALESCE(p_nicho, nicho),
        pais = COALESCE(p_pais, pais),
        proximidade_ativa = COALESCE(p_proximidade_ativa, proximidade_ativa),
        raio_km = COALESCE(p_raio_km, raio_km),
        rating = COALESCE(p_rating, rating),
        total_reviews = COALESCE(p_total_reviews, total_reviews),
        website = COALESCE(p_website, website),
        website_encrypted = CASE WHEN p_website IS NOT NULL AND p_website <> '' THEN public.encrypt_sensitive(p_website) ELSE website_encrypted END,
        whatsapp_number = COALESCE(p_whatsapp_number, whatsapp_number),
        whatsapp_number_encrypted = CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number <> '' THEN public.encrypt_sensitive(p_whatsapp_number) ELSE whatsapp_number_encrypted END,
        whatsapp_on_site = COALESCE(p_whatsapp_on_site, whatsapp_on_site),
        telefone = COALESCE(p_telefone, telefone),
        telefone_encrypted = CASE WHEN p_telefone IS NOT NULL AND p_telefone <> '' THEN public.encrypt_sensitive(p_telefone) ELSE telefone_encrypted END,
        search_run_id = COALESCE(p_search_run_id, search_run_id),
        updated_at = now()
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      nome, company_name, cidade, digital_signals, email, email_encrypted,
      endereco, endereco_encrypted, foco, google_place_id, has_gtag, has_gtm,
      has_meta_pixel, instagram_url, instagram_url_encrypted, latitude,
      longitude, nicho, pais, proximidade_ativa, raio_km, rating,
      total_reviews, user_id, website, website_encrypted, whatsapp_number,
      whatsapp_number_encrypted, whatsapp_on_site, telefone, telefone_encrypted,
      search_run_id
    )
    VALUES (
      p_nome, v_company_name, p_cidade, COALESCE(p_digital_signals, '{}'::jsonb), p_email,
      CASE WHEN p_email IS NOT NULL AND p_email <> '' THEN public.encrypt_sensitive(p_email) ELSE NULL END,
      p_endereco,
      CASE WHEN p_endereco IS NOT NULL AND p_endereco <> '' THEN public.encrypt_sensitive(p_endereco) ELSE NULL END,
      p_foco, p_google_place_id, COALESCE(p_has_gtag, false), COALESCE(p_has_gtm, false),
      COALESCE(p_has_meta_pixel, false), p_instagram_url,
      CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url <> '' THEN public.encrypt_sensitive(p_instagram_url) ELSE NULL END,
      p_latitude, p_longitude, p_nicho, COALESCE(p_pais, 'BR'),
      COALESCE(p_proximidade_ativa, false), p_raio_km, p_rating,
      COALESCE(p_total_reviews, 0), v_user_id, p_website,
      CASE WHEN p_website IS NOT NULL AND p_website <> '' THEN public.encrypt_sensitive(p_website) ELSE NULL END,
      p_whatsapp_number,
      CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number <> '' THEN public.encrypt_sensitive(p_whatsapp_number) ELSE NULL END,
      COALESCE(p_whatsapp_on_site, false), p_telefone,
      CASE WHEN p_telefone IS NOT NULL AND p_telefone <> '' THEN public.encrypt_sensitive(p_telefone) ELSE NULL END,
      p_search_run_id
    )
    RETURNING id INTO v_lead_id;
  END IF;

  RETURN json_build_object('id', v_lead_id, 'is_new', v_is_new, 'success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, jsonb, text, text, text, text, boolean, boolean,
  boolean, text, numeric, numeric, text, text, boolean, integer, numeric,
  integer, uuid, text, text, boolean, text, uuid
) TO authenticated, service_role;
