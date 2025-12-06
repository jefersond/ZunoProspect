-- Create restrictive RLS policies for app_config table
-- These policies block ALL access from anon and authenticated roles
-- Only service_role (which bypasses RLS) can access this table

-- Policy to block ALL operations for authenticated users
CREATE POLICY "Block all access for authenticated users"
ON public.app_config
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Policy to block ALL operations for anonymous users
CREATE POLICY "Block all access for anonymous users"
ON public.app_config
FOR ALL
TO anon
USING (false)
WITH CHECK (false);