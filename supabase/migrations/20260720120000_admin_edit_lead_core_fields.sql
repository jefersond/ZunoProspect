-- Migration: Admin edit lead core fields
-- Allows admins to correct the real lead data (nome, contato, endereco, responsavel)
-- when the data Zuno found is wrong. Admin-only for now (test phase before rolling
-- out to all users who own the lead).

CREATE OR REPLACE FUNCTION public.admin_update_lead_core_fields(
  p_lead_id UUID,
  p_nome TEXT DEFAULT NULL,
  p_whatsapp_link TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_endereco TEXT DEFAULT NULL,
  p_nome_responsavel TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: admin only';
  END IF;

  UPDATE leads
  SET
    nome = COALESCE(p_nome, nome),
    whatsapp_link = COALESCE(p_whatsapp_link, whatsapp_link),
    email = COALESCE(p_email, email),
    website = COALESCE(p_website, website),
    instagram_url = COALESCE(p_instagram_url, instagram_url),
    cidade = COALESCE(p_cidade, cidade),
    endereco = COALESCE(p_endereco, endereco),
    nome_responsavel = COALESCE(p_nome_responsavel, nome_responsavel),
    updated_at = NOW()
  WHERE id = p_lead_id
  RETURNING jsonb_build_object(
    'id', id,
    'nome', nome,
    'whatsapp_link', whatsapp_link,
    'email', email,
    'website', website,
    'instagram_url', instagram_url,
    'cidade', cidade,
    'endereco', endereco,
    'nome_responsavel', nome_responsavel
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Lead not found: %', p_lead_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_lead_core_fields(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;
