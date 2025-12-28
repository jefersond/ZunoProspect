-- Criar nova função RPC que retorna se foi INSERT ou UPDATE
CREATE OR REPLACE FUNCTION public.insert_lead_with_encryption_v2(
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
  p_email text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid;
  v_is_new boolean;
  v_existing_id uuid;
BEGIN
  -- Verifica se já existe um lead com esse google_place_id para esse usuário
  SELECT id INTO v_existing_id
  FROM public.leads
  WHERE google_place_id = p_google_place_id AND user_id = p_user_id;
  
  v_is_new := v_existing_id IS NULL;
  
  IF v_is_new THEN
    -- INSERT novo lead
    INSERT INTO public.leads (
      nome,
      endereco_encrypted,
      telefone_encrypted,
      website_encrypted,
      google_place_id,
      rating,
      total_reviews,
      cidade,
      latitude,
      longitude,
      nicho,
      foco,
      status,
      user_id,
      proximidade_ativa,
      raio_km,
      whatsapp_on_site,
      whatsapp_number_encrypted,
      has_meta_pixel,
      has_gtag,
      has_gtm,
      instagram_url_encrypted,
      digital_signals,
      email_encrypted,
      diagnostico_bullets,
      probabilidade_conversao,
      plano_prospeccao,
      ai_analise_gerada_em
    ) VALUES (
      p_nome,
      public.encrypt_sensitive(p_endereco),
      public.encrypt_sensitive(p_telefone),
      public.encrypt_sensitive(p_website),
      p_google_place_id,
      p_rating,
      p_total_reviews,
      p_cidade,
      p_latitude,
      p_longitude,
      p_nicho,
      p_foco,
      'novo',
      p_user_id,
      p_proximidade_ativa,
      p_raio_km,
      p_whatsapp_on_site,
      public.encrypt_sensitive(p_whatsapp_number),
      p_has_meta_pixel,
      p_has_gtag,
      p_has_gtm,
      public.encrypt_sensitive(p_instagram_url),
      p_digital_signals,
      public.encrypt_sensitive(p_email),
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_lead_id;
  ELSE
    -- UPDATE lead existente
    UPDATE public.leads
    SET
      nome = p_nome,
      endereco_encrypted = public.encrypt_sensitive(p_endereco),
      telefone_encrypted = public.encrypt_sensitive(p_telefone),
      website_encrypted = public.encrypt_sensitive(p_website),
      rating = p_rating,
      total_reviews = p_total_reviews,
      cidade = p_cidade,
      latitude = p_latitude,
      longitude = p_longitude,
      nicho = p_nicho,
      foco = p_foco,
      proximidade_ativa = p_proximidade_ativa,
      raio_km = p_raio_km,
      whatsapp_on_site = p_whatsapp_on_site,
      whatsapp_number_encrypted = public.encrypt_sensitive(p_whatsapp_number),
      has_meta_pixel = p_has_meta_pixel,
      has_gtag = p_has_gtag,
      has_gtm = p_has_gtm,
      instagram_url_encrypted = public.encrypt_sensitive(p_instagram_url),
      digital_signals = p_digital_signals,
      email_encrypted = public.encrypt_sensitive(p_email),
      diagnostico_bullets = NULL,
      probabilidade_conversao = NULL,
      plano_prospeccao = NULL,
      ai_analise_gerada_em = NULL,
      updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_lead_id;
  END IF;
  
  RETURN jsonb_build_object('id', v_lead_id, 'is_new', v_is_new);
END;
$function$;

-- Corrigir dados do Rogério (rogerio_bq@hotmail.com tem 20 leads usados mas só 10 leads reais)
UPDATE public.user_subscriptions
SET leads_used_this_month = 10
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'rogerio_bq@hotmail.com' LIMIT 1
);