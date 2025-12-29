-- Criar função para inserir email_log com criptografia
CREATE OR REPLACE FUNCTION public.insert_email_log_encrypted(
  p_campaign_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_user_email_masked text,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.email_logs (
    campaign_id,
    user_id,
    user_email_encrypted,
    user_email_masked,
    status,
    error_message
  ) VALUES (
    p_campaign_id,
    p_user_id,
    public.encrypt_sensitive(p_user_email),
    p_user_email_masked,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;