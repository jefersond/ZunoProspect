-- Add column for nome_responsavel
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS nome_responsavel TEXT;

-- Drop existing functions to recreate with new return type
DROP FUNCTION IF EXISTS public.get_leads_decrypted();
DROP FUNCTION IF EXISTS public.get_leads_decrypted_filtered(boolean);

-- Recreate get_leads_decrypted function with nome_responsavel
CREATE OR REPLACE FUNCTION public.get_leads_decrypted()
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
  ai_analise_gerada_em timestamp with time zone, 
  proximidade_ativa boolean, 
  raio_km integer, 
  salvo boolean, 
  instagram_context text, 
  user_id uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone,
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
SET search_path TO 'public'
AS $function$
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
    l.updated_at,
    l.cnpj,
    l.razao_social,
    l.nome_responsavel,
    public.decrypt_sensitive(l.cnpj_telefone_encrypted) as cnpj_telefone,
    public.decrypt_sensitive(l.cnpj_email_encrypted) as cnpj_email,
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal
  FROM public.leads l
  WHERE l.user_id = auth.uid();
END;
$function$;

-- Recreate get_leads_decrypted_filtered function
CREATE OR REPLACE FUNCTION public.get_leads_decrypted_filtered(p_salvo boolean DEFAULT NULL::boolean)
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
  ai_analise_gerada_em timestamp with time zone, 
  proximidade_ativa boolean, 
  raio_km integer, 
  salvo boolean, 
  instagram_context text, 
  user_id uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone,
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
SET search_path TO 'public'
AS $function$
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
    l.updated_at,
    l.cnpj,
    l.razao_social,
    l.nome_responsavel,
    public.decrypt_sensitive(l.cnpj_telefone_encrypted) as cnpj_telefone,
    public.decrypt_sensitive(l.cnpj_email_encrypted) as cnpj_email,
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal
  FROM public.leads l
  WHERE l.user_id = auth.uid()
    AND (p_salvo IS NULL OR l.salvo = p_salvo)
  ORDER BY l.created_at DESC;
END;
$function$;