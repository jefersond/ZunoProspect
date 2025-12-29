-- Atualizar função get_leads_decrypted_filtered para aceitar p_user_id como parâmetro
-- Isso corrige o bug quando a função é chamada via service role (admin client)
-- onde auth.uid() retorna NULL

CREATE OR REPLACE FUNCTION public.get_leads_decrypted_filtered(
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
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_id uuid,
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.nome,
    l.cidade,
    l.nicho,
    l.foco,
    l.status,
    l.notas,
    l.rating,
    l.total_reviews,
    l.latitude,
    l.longitude,
    l.google_place_id,
    l.created_at,
    l.updated_at,
    l.user_id,
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
    l.nome_responsavel,
    l.cnpj,
    l.razao_social,
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal,
    decrypt_sensitive(encode(l.telefone_encrypted, 'base64')) AS telefone,
    decrypt_sensitive(encode(l.email_encrypted, 'base64')) AS email,
    decrypt_sensitive(encode(l.endereco_encrypted, 'base64')) AS endereco,
    decrypt_sensitive(encode(l.whatsapp_number_encrypted, 'base64')) AS whatsapp_number,
    decrypt_sensitive(encode(l.website_encrypted, 'base64')) AS website,
    decrypt_sensitive(encode(l.instagram_url_encrypted, 'base64')) AS instagram_url,
    decrypt_sensitive(encode(l.cnpj_telefone_encrypted, 'base64')) AS cnpj_telefone,
    decrypt_sensitive(encode(l.cnpj_email_encrypted, 'base64')) AS cnpj_email
  FROM public.leads l
  WHERE l.user_id = COALESCE(p_user_id, auth.uid())
    AND (p_salvo IS NULL OR l.salvo = p_salvo)
  ORDER BY l.created_at DESC;
END;
$$;

-- Comentário explicando a mudança
COMMENT ON FUNCTION public.get_leads_decrypted_filtered(boolean, uuid) IS 
'Retorna leads do usuário com campos sensíveis descriptografados. 
Aceita p_user_id explícito para uso via service role quando auth.uid() é NULL.';