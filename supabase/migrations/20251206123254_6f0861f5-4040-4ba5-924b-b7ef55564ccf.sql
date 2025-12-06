-- Update encrypt_sensitive to require encryption_key (no hardcoded fallback)
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
  
  -- Get encryption key from app settings - MUST be configured
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in your database configuration.';
  END IF;
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$function$;

-- Update decrypt_sensitive to require encryption_key (no hardcoded fallback)
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
  
  -- Get encryption key from app settings - MUST be configured
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in your database configuration.';
  END IF;
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return NULL for graceful handling of corrupted data
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$function$;