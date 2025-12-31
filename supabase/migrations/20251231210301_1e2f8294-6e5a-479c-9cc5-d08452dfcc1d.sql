-- Add foreign key between user_subscriptions and profiles for better joins
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT user_subscriptions_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create table to track welcome emails sent (instant on signup)
CREATE TABLE IF NOT EXISTS public.welcome_emails_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.welcome_emails_sent ENABLE ROW LEVEL SECURITY;

-- RLS policies for welcome_emails_sent
CREATE POLICY "Admins can view welcome emails" 
ON public.welcome_emails_sent 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_welcome_emails_user_id ON public.welcome_emails_sent(user_id);

-- Create trigger function to call welcome email edge function on new user
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log that we're attempting to send a welcome email
  -- The actual email sending is done via edge function webhook
  INSERT INTO public.welcome_emails_sent (user_id, status)
  VALUES (NEW.id, 'pending');
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (runs after handle_new_user creates profile)
DROP TRIGGER IF EXISTS on_new_profile_welcome_email ON public.profiles;
CREATE TRIGGER on_new_profile_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_welcome_email();