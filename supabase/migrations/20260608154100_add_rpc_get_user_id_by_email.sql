-- Criar a RPC para buscar usuário por email de forma direta no banco de dados (RLS Bypass via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated, service_role;
