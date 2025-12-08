-- Criar função para atualizar campos criptografados de leads
CREATE OR REPLACE FUNCTION public.update_lead_encrypted_fields(
  p_lead_id uuid,
  p_instagram_url text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se o usuário é dono do lead
  IF NOT EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = p_lead_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: lead não pertence ao usuário';
  END IF;

  UPDATE public.leads
  SET 
    instagram_url_encrypted = CASE 
      WHEN p_instagram_url IS NOT NULL THEN public.encrypt_sensitive(p_instagram_url)
      ELSE instagram_url_encrypted
    END,
    email_encrypted = CASE 
      WHEN p_email IS NOT NULL THEN public.encrypt_sensitive(p_email)
      ELSE email_encrypted
    END,
    whatsapp_number_encrypted = CASE 
      WHEN p_whatsapp_number IS NOT NULL THEN public.encrypt_sensitive(p_whatsapp_number)
      ELSE whatsapp_number_encrypted
    END,
    updated_at = now()
  WHERE id = p_lead_id;
END;
$$;