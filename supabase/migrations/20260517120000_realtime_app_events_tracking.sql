-- Real-time product analytics for Zuno Propect.

CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_events
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS pathname text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS offer text,
  ADD COLUMN IF NOT EXISTS first_touch jsonb,
  ADD COLUMN IF NOT EXISTS last_touch jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_events_event_type ON public.app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON public.app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_email ON public.app_events(email);
CREATE INDEX IF NOT EXISTS idx_app_events_anonymous_id ON public.app_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_app_events_session_id ON public.app_events(session_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at_desc ON public.app_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_utm_campaign ON public.app_events(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_app_events_utm_content ON public.app_events(utm_content);
CREATE INDEX IF NOT EXISTS idx_app_events_utm_source ON public.app_events(utm_source);
CREATE INDEX IF NOT EXISTS idx_app_events_event_name ON public.app_events(event_name);
CREATE INDEX IF NOT EXISTS idx_app_events_type_created ON public.app_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_user_created ON public.app_events(user_id, created_at DESC);

DROP POLICY IF EXISTS "Admins can read app events" ON public.app_events;
CREATE POLICY "Admins can read app events"
ON public.app_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage app events" ON public.app_events;
CREATE POLICY "Service role can manage app events"
ON public.app_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_app_event(
  p_user_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  END IF;

  INSERT INTO public.app_events (
    user_id,
    email,
    event_type,
    event_data,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    v_email,
    p_event_type,
    COALESCE(p_event_data, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_event(uuid, text, jsonb, text, text) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'app_events'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_events;
  END IF;
END;
$$;
