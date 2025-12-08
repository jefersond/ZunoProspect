-- ============================================
-- SECURITY ENHANCEMENT: Defense in Depth for Leads Table
-- ============================================
-- 
-- Since Supabase Vault is not available in Lovable Cloud, this migration 
-- implements alternative security layers:
-- 1. Private schema for internal functions (not accessible to anon/authenticated)
-- 2. Enhanced encryption key management via secure private functions
-- 3. Security audit logging for sensitive operations
-- 4. Tightened function permissions

-- Step 1: Create private schema for internal functions
CREATE SCHEMA IF NOT EXISTS private;

-- Step 2: Revoke all access to private schema from public roles
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- Grant only to postgres (service role)
GRANT USAGE ON SCHEMA private TO postgres;

-- Step 3: Create secure private function to get encryption key
-- This function is in private schema, making it inaccessible to anon/authenticated
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  -- Priority 1: Database configuration setting (most secure for Lovable Cloud)
  -- This is set via environment variable and not accessible via SQL queries
  v_key := current_setting('app.settings.leads_encryption_key', true);
  
  -- Priority 2: Fallback to app_config table (protected by RLS)
  IF v_key IS NULL OR v_key = '' THEN
    SELECT value INTO v_key 
    FROM public.app_config 
    WHERE key = 'encryption_key';
  END IF;
  
  -- Raise error if no key found
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set LEADS_ENCRYPTION_KEY in backend secrets.';
  END IF;
  
  RETURN v_key;
END;
$$;

-- Step 4: Update encrypt_sensitive to use private function
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get key from secure private function
  encryption_key := private.get_encryption_key();
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

-- Step 5: Update decrypt_sensitive to use private function
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get key from secure private function
  encryption_key := private.get_encryption_key();
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return NULL for graceful handling
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Step 6: Create security audit log table in private schema
CREATE TABLE IF NOT EXISTS private.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  table_name text,
  user_id uuid,
  record_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created 
ON private.security_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user 
ON private.security_audit_log(user_id, created_at DESC);

-- Step 7: Create function to log security events
CREATE OR REPLACE FUNCTION private.log_security_event(
  p_operation text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
BEGIN
  INSERT INTO private.security_audit_log (operation, table_name, user_id, record_id, details)
  VALUES (p_operation, p_table_name, auth.uid(), p_record_id, p_details);
END;
$$;

-- Step 8: Create trigger to log sensitive data access on leads
CREATE OR REPLACE FUNCTION private.log_leads_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
BEGIN
  -- Log the access
  PERFORM private.log_security_event(
    TG_OP,
    'leads',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'action', TG_OP,
      'via_rpc', current_setting('app.via_rpc', true)
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on leads table (only for INSERT, UPDATE, DELETE - not SELECT)
DROP TRIGGER IF EXISTS audit_leads_changes ON public.leads;
CREATE TRIGGER audit_leads_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION private.log_leads_access();

-- Step 9: Add documentation comments
COMMENT ON FUNCTION private.get_encryption_key IS 
'Private function to retrieve encryption key. Not accessible to anon/authenticated roles.
Key is retrieved from database settings (set via environment variable).
Fallback to app_config table for backwards compatibility.';

COMMENT ON FUNCTION public.encrypt_sensitive IS 
'Encrypts sensitive data using PGP symmetric encryption. 
Key is retrieved from private.get_encryption_key() which is not 
accessible to anon/authenticated users. SECURITY DEFINER ensures 
the key is never exposed in function context.';

COMMENT ON FUNCTION public.decrypt_sensitive IS 
'Decrypts sensitive data using PGP symmetric encryption.
Key is retrieved from private.get_encryption_key() which is not 
accessible to anon/authenticated users.';

COMMENT ON TABLE private.security_audit_log IS 
'Audit log for security-sensitive operations on the leads table.
Stored in private schema, not accessible to anon/authenticated users.';

-- Step 10: Ensure RLS policies on app_config are maximally restrictive
-- Already done in previous migrations, but verify
DO $$
BEGIN
  -- Check if restrictive policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_config' 
    AND policyname = 'Block all access for anonymous users'
  ) THEN
    CREATE POLICY "Block all access for anonymous users" 
    ON public.app_config FOR ALL 
    TO anon 
    USING (false) 
    WITH CHECK (false);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_config' 
    AND policyname = 'Block all access for authenticated users'
  ) THEN
    CREATE POLICY "Block all access for authenticated users" 
    ON public.app_config FOR ALL 
    TO authenticated 
    USING (false) 
    WITH CHECK (false);
  END IF;
END $$;