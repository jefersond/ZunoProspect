-- Remover constraint antiga UNIQUE(google_place_id) e criar nova UNIQUE(google_place_id, user_id)
-- Isso permite que cada usuário tenha sua própria cópia dos leads

-- Primeiro, dropar a constraint existente (pode ter nomes diferentes)
DO $$ 
BEGIN
  -- Tenta dropar pelo nome mais comum
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_google_place_id_key') THEN
    ALTER TABLE public.leads DROP CONSTRAINT leads_google_place_id_key;
  END IF;
  
  -- Tenta dropar índice único se existir
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'leads_google_place_id_key') THEN
    DROP INDEX IF EXISTS leads_google_place_id_key;
  END IF;
END $$;

-- Criar nova constraint composta que permite mesmo place_id para diferentes usuários
CREATE UNIQUE INDEX IF NOT EXISTS leads_google_place_id_user_id_key 
ON public.leads (google_place_id, user_id);

-- Atualizar a função insert_lead_with_encryption para usar o novo constraint
CREATE OR REPLACE FUNCTION public.insert_lead_with_encryption(
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
  p_digital_signals jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid;
BEGIN
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
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (google_place_id, user_id) 
  DO UPDATE SET
    nome = EXCLUDED.nome,
    endereco_encrypted = EXCLUDED.endereco_encrypted,
    telefone_encrypted = EXCLUDED.telefone_encrypted,
    website_encrypted = EXCLUDED.website_encrypted,
    rating = EXCLUDED.rating,
    total_reviews = EXCLUDED.total_reviews,
    cidade = EXCLUDED.cidade,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    nicho = EXCLUDED.nicho,
    foco = EXCLUDED.foco,
    proximidade_ativa = EXCLUDED.proximidade_ativa,
    raio_km = EXCLUDED.raio_km,
    whatsapp_on_site = EXCLUDED.whatsapp_on_site,
    whatsapp_number_encrypted = EXCLUDED.whatsapp_number_encrypted,
    has_meta_pixel = EXCLUDED.has_meta_pixel,
    has_gtag = EXCLUDED.has_gtag,
    has_gtm = EXCLUDED.has_gtm,
    instagram_url_encrypted = EXCLUDED.instagram_url_encrypted,
    digital_signals = EXCLUDED.digital_signals,
    diagnostico_bullets = NULL,
    probabilidade_conversao = NULL,
    plano_prospeccao = NULL,
    ai_analise_gerada_em = NULL,
    updated_at = now()
  RETURNING id INTO v_lead_id;
  
  RETURN v_lead_id;
END;
$function$;