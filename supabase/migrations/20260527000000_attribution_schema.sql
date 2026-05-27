-- Migration to support Multi-Touch Attribution (First Touch & Last Touch) in Zuno Propect
-- This allows persistent, deterministic tracking of user acquisition channels.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_utm_source text,
  ADD COLUMN IF NOT EXISTS first_utm_medium text,
  ADD COLUMN IF NOT EXISTS first_utm_campaign text,
  ADD COLUMN IF NOT EXISTS first_utm_content text,
  ADD COLUMN IF NOT EXISTS first_referrer text,
  ADD COLUMN IF NOT EXISTS first_landing_page text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_event_source_type text,
  ADD COLUMN IF NOT EXISTS first_creative_name text,
  
  ADD COLUMN IF NOT EXISTS last_utm_source text,
  ADD COLUMN IF NOT EXISTS last_utm_medium text,
  ADD COLUMN IF NOT EXISTS last_utm_campaign text,
  ADD COLUMN IF NOT EXISTS last_utm_content text,
  ADD COLUMN IF NOT EXISTS last_referrer text,
  ADD COLUMN IF NOT EXISTS last_landing_page text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_source_type text,
  ADD COLUMN IF NOT EXISTS last_creative_name text;

-- Add comment on columns for documentation
COMMENT ON COLUMN public.profiles.first_utm_source IS 'Origem de aquisição inicial do usuário (First Touch)';
COMMENT ON COLUMN public.profiles.first_event_source_type IS 'Tipo classificado da origem inicial (paid, organic, direct, referral, internal_test, unknown)';
COMMENT ON COLUMN public.profiles.last_utm_source IS 'Origem de contato mais recente na sessão ativa (Last Touch)';
COMMENT ON COLUMN public.profiles.last_event_source_type IS 'Tipo classificado da origem mais recente';
