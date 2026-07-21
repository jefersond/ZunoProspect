-- Secure admin-only correction of the real fields shown in prospecting.
-- Sensitive contact fields remain encrypted and the encryption key is only
-- supplied by the get-leads-secure Edge Function through the service role.

CREATE TABLE IF NOT EXISTS public.lead_manual_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lead_manual_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read lead manual edits" ON public.lead_manual_edits;
CREATE POLICY "Admins can read lead manual edits"
  ON public.lead_manual_edits
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.lead_manual_edits FROM anon, authenticated;
GRANT SELECT ON TABLE public.lead_manual_edits TO authenticated;

-- Remove the first experimental RPC. It referenced legacy plaintext columns
-- and accepted browser calls without access to the encryption key.
DROP FUNCTION IF EXISTS public.admin_update_lead_core_fields(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.admin_update_lead_core_fields(
  p_encryption_key TEXT,
  p_lead_id UUID,
  p_edited_by UUID,
  p_nome TEXT,
  p_nome_responsavel TEXT,
  p_telefone TEXT,
  p_whatsapp_number TEXT,
  p_email TEXT,
  p_website TEXT,
  p_instagram_url TEXT,
  p_cidade TEXT,
  p_endereco TEXT,
  p_nicho TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_before JSONB;
  v_changed_fields TEXT[];
  v_updated_id UUID;
  v_nome TEXT := NULLIF(BTRIM(COALESCE(p_nome, '')), '');
  v_nome_responsavel TEXT := NULLIF(BTRIM(COALESCE(p_nome_responsavel, '')), '');
  v_telefone TEXT := NULLIF(BTRIM(COALESCE(p_telefone, '')), '');
  v_whatsapp_number TEXT := NULLIF(BTRIM(COALESCE(p_whatsapp_number, '')), '');
  v_email TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_email, ''))), '');
  v_website TEXT := NULLIF(BTRIM(COALESCE(p_website, '')), '');
  v_instagram_url TEXT := NULLIF(BTRIM(COALESCE(p_instagram_url, '')), '');
  v_cidade TEXT := NULLIF(BTRIM(COALESCE(p_cidade, '')), '');
  v_endereco TEXT := NULLIF(BTRIM(COALESCE(p_endereco, '')), '');
  v_nicho TEXT := NULLIF(BTRIM(COALESCE(p_nicho, '')), '');
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized: service role only';
  END IF;

  IF p_edited_by IS NULL OR NOT public.is_admin(p_edited_by) THEN
    RAISE EXCEPTION 'Not authorized: admin only';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_encryption_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Encryption key is required';
  END IF;

  IF v_nome IS NULL OR v_cidade IS NULL OR v_nicho IS NULL THEN
    RAISE EXCEPTION 'Nome, cidade e nicho sao obrigatorios';
  END IF;

  PERFORM set_config('app.leads_key', p_encryption_key, true);

  SELECT jsonb_build_object(
    'nome', l.nome,
    'nome_responsavel', l.nome_responsavel,
    'telefone', public.decrypt_sensitive(l.telefone_encrypted),
    'whatsapp_number', public.decrypt_sensitive(l.whatsapp_number_encrypted),
    'email', public.decrypt_sensitive(l.email_encrypted),
    'website', public.decrypt_sensitive(l.website_encrypted),
    'instagram_url', public.decrypt_sensitive(l.instagram_url_encrypted),
    'cidade', l.cidade,
    'endereco', public.decrypt_sensitive(l.endereco_encrypted),
    'nicho', l.nicho
  )
  INTO v_before
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Lead not found: %', p_lead_id;
  END IF;

  v_changed_fields := ARRAY_REMOVE(ARRAY[
    CASE WHEN v_before->>'nome' IS DISTINCT FROM v_nome THEN 'nome' END,
    CASE WHEN v_before->>'nome_responsavel' IS DISTINCT FROM v_nome_responsavel THEN 'nome_responsavel' END,
    CASE WHEN v_before->>'telefone' IS DISTINCT FROM v_telefone THEN 'telefone' END,
    CASE WHEN v_before->>'whatsapp_number' IS DISTINCT FROM v_whatsapp_number THEN 'whatsapp_number' END,
    CASE WHEN v_before->>'email' IS DISTINCT FROM v_email THEN 'email' END,
    CASE WHEN v_before->>'website' IS DISTINCT FROM v_website THEN 'website' END,
    CASE WHEN v_before->>'instagram_url' IS DISTINCT FROM v_instagram_url THEN 'instagram_url' END,
    CASE WHEN v_before->>'cidade' IS DISTINCT FROM v_cidade THEN 'cidade' END,
    CASE WHEN v_before->>'endereco' IS DISTINCT FROM v_endereco THEN 'endereco' END,
    CASE WHEN v_before->>'nicho' IS DISTINCT FROM v_nicho THEN 'nicho' END
  ], NULL);

  UPDATE public.leads
  SET
    nome = v_nome,
    nome_responsavel = v_nome_responsavel,
    telefone_encrypted = CASE WHEN v_telefone IS NULL THEN NULL ELSE public.encrypt_sensitive(v_telefone) END,
    whatsapp_number_encrypted = CASE WHEN v_whatsapp_number IS NULL THEN NULL ELSE public.encrypt_sensitive(v_whatsapp_number) END,
    email_encrypted = CASE WHEN v_email IS NULL THEN NULL ELSE public.encrypt_sensitive(v_email) END,
    website_encrypted = CASE WHEN v_website IS NULL THEN NULL ELSE public.encrypt_sensitive(v_website) END,
    instagram_url_encrypted = CASE WHEN v_instagram_url IS NULL THEN NULL ELSE public.encrypt_sensitive(v_instagram_url) END,
    cidade = v_cidade,
    endereco_encrypted = CASE WHEN v_endereco IS NULL THEN NULL ELSE public.encrypt_sensitive(v_endereco) END,
    nicho = v_nicho,
    data_sources = COALESCE(data_sources, '{}'::JSONB) || jsonb_build_object(
      'nome', 'manual',
      'nome_responsavel', 'manual',
      'telefone', 'manual',
      'whatsapp_number', 'manual',
      'email', 'manual',
      'website', 'manual',
      'instagram_url', 'manual',
      'cidade', 'manual',
      'endereco', 'manual',
      'nicho', 'manual'
    ),
    updated_at = NOW()
  WHERE id = p_lead_id
  RETURNING id INTO v_updated_id;

  IF CARDINALITY(v_changed_fields) > 0 THEN
    INSERT INTO public.lead_manual_edits (lead_id, edited_by, changed_fields)
    VALUES (p_lead_id, p_edited_by, v_changed_fields);
  END IF;

  RETURN jsonb_build_object(
    'id', v_updated_id,
    'nome', v_nome,
    'nome_responsavel', v_nome_responsavel,
    'telefone', v_telefone,
    'whatsapp_number', v_whatsapp_number,
    'email', v_email,
    'website', v_website,
    'instagram_url', v_instagram_url,
    'cidade', v_cidade,
    'endereco', v_endereco,
    'nicho', v_nicho,
    'changed_fields', to_jsonb(v_changed_fields),
    'source', 'manual'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_lead_core_fields(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_lead_core_fields(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.admin_update_lead_core_fields(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS 'Admin-only lead correction called by get-leads-secure; sensitive fields remain encrypted.';
