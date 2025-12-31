-- Add opened_at column to track when emails are opened
ALTER TABLE public.onboarding_emails_sent 
ADD COLUMN opened_at timestamp with time zone DEFAULT NULL;

-- Add index for metrics queries
CREATE INDEX idx_onboarding_emails_opened 
ON public.onboarding_emails_sent(email_type, opened_at);

-- Add index for user lookups
CREATE INDEX idx_onboarding_emails_user_type 
ON public.onboarding_emails_sent(user_id, email_type, sent_at DESC);