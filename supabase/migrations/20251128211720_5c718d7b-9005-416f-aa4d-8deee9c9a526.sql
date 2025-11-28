-- Função para buscar leads descriptografados com filtro de salvos
CREATE OR REPLACE FUNCTION public.get_leads_decrypted_filtered(p_salvo boolean DEFAULT NULL)
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
  WHERE l.user_id = auth.uid()
    AND (p_salvo IS NULL OR l.salvo = p_salvo)
  ORDER BY l.created_at DESC;
END;
$$;