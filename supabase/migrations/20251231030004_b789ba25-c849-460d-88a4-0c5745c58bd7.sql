-- ============================================
-- EMAIL LOGS PRIVACY HARDENING MIGRATION
-- ============================================

-- 1. Add HMAC fingerprint column for pseudonymous linking
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS user_email_fingerprint text;
COMMENT ON COLUMN public.email_logs.user_email_fingerprint IS 'HMAC-SHA256 fingerprint for pseudonymous analytics. Cannot be reversed.';

-- 2. Add retention column
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz DEFAULT (now() + interval '90 days');

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_fingerprint ON public.email_logs(user_email_fingerprint);
CREATE INDEX IF NOT EXISTS idx_email_logs_retention ON public.email_logs(retention_expires_at);

-- 4. Create audit table for email log access
CREATE TABLE IF NOT EXISTS public.email_logs_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id uuid NOT NULL,
  action_type text NOT NULL,
  reason_code text,
  record_count integer DEFAULT 0,
  filters_used jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert audit"
  ON public.email_logs_access_audit FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can view email access audit"
  ON public.email_logs_access_audit FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 5. Update RLS on email_logs - block direct access
DROP POLICY IF EXISTS "Admins can view logs" ON public.email_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.email_logs;

CREATE POLICY "Block direct select on email_logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (false);

CREATE POLICY "Block direct insert on email_logs"
  ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Service role full access on email_logs"
  ON public.email_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 6. Create safe email mask function (non-identifying)
CREATE OR REPLACE FUNCTION public.generate_safe_email_mask(email text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  domain_part text;
BEGIN
  IF email IS NULL OR email = '' THEN RETURN '*@unknown'; END IF;
  domain_part := lower(split_part(email, '@', 2));
  
  IF domain_part LIKE '%gmail%' THEN RETURN '*@gmail';
  ELSIF domain_part LIKE '%hotmail%' OR domain_part LIKE '%outlook%' THEN RETURN '*@outlook';
  ELSIF domain_part LIKE '%yahoo%' THEN RETURN '*@yahoo';
  ELSIF domain_part LIKE '%icloud%' THEN RETURN '*@icloud';
  ELSE RETURN '*@corp';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_safe_email_mask(text) FROM PUBLIC, authenticated, anon;

-- 7. Create HMAC fingerprint function
CREATE OR REPLACE FUNCTION public.generate_email_fingerprint(email text, pepper text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF email IS NULL OR pepper IS NULL OR pepper = '' THEN RETURN NULL; END IF;
  RETURN encode(extensions.hmac(lower(trim(email))::bytea, pepper::bytea, 'sha256'), 'hex');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_email_fingerprint(text, text) FROM PUBLIC, authenticated, anon;

-- 8. Create secure insert function for Edge Functions
CREATE OR REPLACE FUNCTION public.insert_email_log_secure(
  p_pepper text,
  p_encryption_key text,
  p_campaign_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF p_pepper IS NULL OR p_pepper = '' THEN
    RAISE EXCEPTION 'Pepper required' USING ERRCODE = 'P0500';
  END IF;
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key required' USING ERRCODE = 'P0500';
  END IF;
  
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  INSERT INTO public.email_logs (
    campaign_id, user_id, user_email_encrypted, user_email_masked,
    user_email_fingerprint, status, error_message, retention_expires_at
  ) VALUES (
    p_campaign_id, p_user_id, public.encrypt_sensitive(p_user_email),
    public.generate_safe_email_mask(p_user_email),
    public.generate_email_fingerprint(p_user_email, p_pepper),
    p_status, p_error_message, now() + interval '90 days'
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.insert_email_log_secure(text, text, uuid, uuid, text, text, text) FROM PUBLIC, authenticated, anon;

-- 9. Create secure read function (no decryption)
CREATE OR REPLACE FUNCTION public.read_email_logs_secure(
  p_pepper text,
  p_campaign_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid, campaign_id uuid, user_id uuid, user_email_masked text,
  user_email_fingerprint text, status text, error_message text,
  sent_at timestamptz, opened_at timestamptz, clicked_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF p_pepper IS NULL OR p_pepper = '' THEN
    RAISE EXCEPTION 'Auth required' USING ERRCODE = 'P0401';
  END IF;
  
  RETURN QUERY
  SELECT el.id, el.campaign_id, el.user_id, el.user_email_masked,
    el.user_email_fingerprint, el.status, el.error_message,
    el.sent_at, el.opened_at, el.clicked_at
  FROM public.email_logs el
  WHERE (p_campaign_id IS NULL OR el.campaign_id = p_campaign_id)
  ORDER BY el.created_at DESC LIMIT LEAST(p_limit, 1000);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_logs_secure(text, uuid, integer) FROM PUBLIC, authenticated, anon;

-- 10. Create audited decryption function (service_role only)
CREATE OR REPLACE FUNCTION public.decrypt_email_log_audited(
  p_encryption_key text, p_log_id uuid, p_reason_code text, p_accessor_user_id uuid
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_encrypted bytea;
  v_decrypted text;
BEGIN
  IF p_encryption_key IS NULL OR p_encryption_key = '' THEN
    RAISE EXCEPTION 'Key required' USING ERRCODE = 'P0500';
  END IF;
  IF p_reason_code IS NULL OR p_reason_code = '' THEN
    RAISE EXCEPTION 'Reason required for audit' USING ERRCODE = 'P0400';
  END IF;
  
  PERFORM set_config('app.leads_key', p_encryption_key, true);
  
  SELECT user_email_encrypted INTO v_encrypted FROM public.email_logs WHERE id = p_log_id;
  IF v_encrypted IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0404'; END IF;
  
  v_decrypted := public.decrypt_sensitive(v_encrypted);
  
  INSERT INTO public.email_logs_access_audit (accessor_user_id, action_type, reason_code, record_count, filters_used)
  VALUES (p_accessor_user_id, 'decrypt_email', p_reason_code, 1, jsonb_build_object('log_id', p_log_id));
  
  RETURN v_decrypted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrypt_email_log_audited(text, uuid, text, uuid) FROM PUBLIC, authenticated, anon;

-- 11. Create retention cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_email_logs()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.email_logs WHERE retention_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_email_logs() FROM PUBLIC, authenticated, anon;

-- 12. Backfill existing masked emails to non-identifying format
UPDATE public.email_logs
SET user_email_masked = '*@' || 
  CASE 
    WHEN user_email_masked ILIKE '%gmail%' THEN 'gmail'
    WHEN user_email_masked ILIKE '%hotmail%' OR user_email_masked ILIKE '%outlook%' THEN 'outlook'
    WHEN user_email_masked ILIKE '%yahoo%' THEN 'yahoo'
    ELSE 'corp'
  END
WHERE user_email_masked IS NOT NULL AND user_email_masked NOT LIKE '*@%';

-- 13. Deprecate old insert function
REVOKE EXECUTE ON FUNCTION public.insert_email_log_encrypted(uuid, uuid, text, text, text, text) FROM PUBLIC, authenticated, anon;