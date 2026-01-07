-- Add service_role policy for email_job_locks table
-- This table is used by Edge Functions to prevent concurrent email sending
-- Only service_role should have access, never authenticated users

CREATE POLICY "Service role can manage locks"
  ON public.email_job_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);