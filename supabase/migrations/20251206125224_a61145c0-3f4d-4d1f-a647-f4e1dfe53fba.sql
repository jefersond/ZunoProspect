-- Create a secure configuration table to store the encryption key
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - only service role can access
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No public policies - only accessible via SECURITY DEFINER functions
-- This means regular users cannot read the encryption key

-- Insert the encryption key (only if not exists)
INSERT INTO public.app_config (key, value) 
VALUES ('encryption_key', 'zuno_prospect_enc_key_2024_x9k7m3p5w2v8n1q6')
ON CONFLICT (key) DO NOTHING;

-- Update encrypt_sensitive to read from config table
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get encryption key from config table
  SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  
  -- Fail if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured in app_config table.';
  END IF;
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$function$;

-- Update decrypt_sensitive to read from config table
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data bytea)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get encryption key from config table
  SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  
  -- Fail if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured in app_config table.';
  END IF;
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return NULL for graceful handling of corrupted data
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$function$;