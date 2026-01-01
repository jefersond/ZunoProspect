-- Create email job lock table to prevent concurrent email sending
CREATE TABLE public.email_job_locks (
  job_name TEXT PRIMARY KEY,
  locked_until TIMESTAMP WITH TIME ZONE,
  locked_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_job_locks ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (via edge functions)
-- No user policies needed - this is internal

-- Insert default job entries
INSERT INTO public.email_job_locks (job_name, locked_until, locked_by) VALUES
  ('send-email-campaign', NULL, NULL),
  ('send-onboarding-email', NULL, NULL),
  ('send-welcome-email', NULL, NULL)
ON CONFLICT (job_name) DO NOTHING;

COMMENT ON TABLE public.email_job_locks IS 'Prevents concurrent email sending jobs to avoid rate limiting';