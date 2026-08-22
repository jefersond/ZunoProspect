-- Harden sensitive SECURITY DEFINER RPCs without changing their behavior.
--
-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Several legacy migrations later granted authenticated/service_role explicitly,
-- but did not revoke the inherited PUBLIC permission. Because anon is a member of
-- PUBLIC, those RPCs remained callable without a signed-in session.
--
-- This migration only changes ACLs. It intentionally does not alter function
-- bodies, lead data, or the legacy encrypt_sensitive/decrypt_sensitive behavior.

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_update_lead_custom_fields(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_lead_custom_fields(uuid, jsonb) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.check_leads_rate_limit(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_leads_rate_limit(uuid, integer, integer) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.decrypt_sensitive(bytea) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive(bytea) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.encrypt_sensitive(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive(text) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_lead_decrypted_by_id(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_decrypted_by_id(uuid, uuid) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.increment_leads_usage(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_leads_usage(uuid, integer) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.increment_leads_used(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_leads_used(uuid, integer) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.log_leads_access(uuid, text, uuid[], integer, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_leads_access(uuid, text, uuid[], integer, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.reset_monthly_leads_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_monthly_leads_count() TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, uuid, uuid, boolean) TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, jsonb, text, text, text, text, boolean, boolean,
  boolean, text, numeric, numeric, text, text, boolean, integer, numeric,
  integer, uuid, text, text, boolean, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(
  text, text, text, jsonb, text, text, text, text, boolean, boolean,
  boolean, text, numeric, numeric, text, text, boolean, integer, numeric,
  integer, uuid, text, text, boolean, text, uuid
) TO authenticated, service_role;
