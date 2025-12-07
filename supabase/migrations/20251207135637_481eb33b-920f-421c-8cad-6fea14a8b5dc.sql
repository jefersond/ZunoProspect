-- Migration: Move encryption key from database to environment variable
-- This ensures encryption keys are managed outside the database for better security

-- Update encrypt_sensitive function to use environment variable via pg_settings
-- The LEADS_ENCRYPTION_KEY will be set via ALTER DATABASE or config parameter
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
  
  -- Try to get encryption key from app settings (set via ALTER DATABASE or config)
  encryption_key := current_setting('app.settings.leads_encryption_key', true);
  
  -- Fallback to app_config table if setting not available
  IF encryption_key IS NULL OR encryption_key = '' THEN
    SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  END IF;
  
  -- Fail if encryption key is not configured anywhere
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.leads_encryption_key or configure in app_config table.';
  END IF;
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$function$;

-- Update decrypt_sensitive function to use environment variable via pg_settings
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
  
  -- Try to get encryption key from app settings (set via ALTER DATABASE or config)
  encryption_key := current_setting('app.settings.leads_encryption_key', true);
  
  -- Fallback to app_config table if setting not available
  IF encryption_key IS NULL OR encryption_key = '' THEN
    SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  END IF;
  
  -- Fail if encryption key is not configured anywhere
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.leads_encryption_key or configure in app_config table.';
  END IF;
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return NULL for graceful handling of corrupted data
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$function$;

-- Add comment explaining the security approach
COMMENT ON FUNCTION public.encrypt_sensitive(text) IS 'Encrypts sensitive data using PGP symmetric encryption. Key should be set via app.settings.leads_encryption_key configuration parameter for production use.';
COMMENT ON FUNCTION public.decrypt_sensitive(bytea) IS 'Decrypts sensitive data. Falls back to app_config table if configuration parameter not set.';