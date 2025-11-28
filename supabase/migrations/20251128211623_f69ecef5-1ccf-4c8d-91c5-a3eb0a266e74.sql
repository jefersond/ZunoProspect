-- Função RPC para inserir/atualizar leads com criptografia automática
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
SET search_path = public
AS $$
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
    -- Limpa análise IA para regeneração
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
  ON CONFLICT (google_place_id) 
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
    -- Limpa análise IA para regeneração com novo foco
    diagnostico_bullets = NULL,
    probabilidade_conversao = NULL,
    plano_prospeccao = NULL,
    ai_analise_gerada_em = NULL,
    updated_at = now()
  RETURNING id INTO v_lead_id;
  
  RETURN v_lead_id;
END;
$$;

-- Função para buscar leads descriptografados (para o próprio usuário)
CREATE OR REPLACE FUNCTION public.get_leads_decrypted()
RETURNS TABLE (
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
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.google_place_id,
    l.nome,
    public.decrypt_sensitive(l.telefone_encrypted) as telefone,
    public.decrypt_sensitive(l.email_encrypted) as email,
    public.decrypt_sensitive(l.endereco_encrypted) as endereco,
    public.decrypt_sensitive(l.whatsapp_number_encrypted) as whatsapp_number,
    public.decrypt_sensitive(l.website_encrypted) as website,
    public.decrypt_sensitive(l.instagram_url_encrypted) as instagram_url,
    l.cidade,
    l.nicho,
    l.foco,
    l.status,
    l.notas,
    l.rating,
    l.total_reviews,
    l.latitude,
    l.longitude,
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
    l.user_id,
    l.created_at,
    l.updated_at
  FROM public.leads l
  WHERE l.user_id = auth.uid();
END;
$$;