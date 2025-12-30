-- Tabela para rastrear emails de onboarding enviados
CREATE TABLE public.onboarding_emails_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email_type text NOT NULL DEFAULT 'first_24h',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_emails_sent ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admins podem ver
CREATE POLICY "Admins can view onboarding emails" 
ON public.onboarding_emails_sent 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Index para busca rápida
CREATE INDEX idx_onboarding_emails_user_id ON public.onboarding_emails_sent(user_id);
CREATE INDEX idx_onboarding_emails_type ON public.onboarding_emails_sent(email_type);