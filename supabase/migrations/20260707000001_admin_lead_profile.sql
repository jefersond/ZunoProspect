-- Migration: Admin Lead Profile
-- Adds custom_fields (admin-editable) and data quality tracking columns to leads table

-- 1. Custom fields: free-form key-value pairs only admins can write
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 2. Data quality tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_used_fallback BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_fallback_reason TEXT;

-- 3. Index for JSONB queries on custom_fields
CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON leads USING GIN (custom_fields);

-- 4. RLS policy: only admins can update custom_fields
-- Regular users can still update notas, salvo, status (existing policies unchanged)
CREATE POLICY "Admin can update custom_fields"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. RLS policy: all authenticated users can read custom_fields (it's non-sensitive)
-- (existing SELECT policies already cover this via row-level ownership)

-- 6. Function: admin-safe update of custom_fields (bypasses user_id constraint)
CREATE OR REPLACE FUNCTION public.admin_update_lead_custom_fields(
  p_lead_id UUID,
  p_custom_fields JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: admin only';
  END IF;

  UPDATE leads
  SET custom_fields = p_custom_fields,
      updated_at = NOW()
  WHERE id = p_lead_id
  RETURNING jsonb_build_object(
    'id', id,
    'nome', nome,
    'custom_fields', custom_fields
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Lead not found: %', p_lead_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_lead_custom_fields(UUID, JSONB)
  TO authenticated, service_role;
