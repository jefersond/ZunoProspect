ALTER TABLE public.app_events
ADD COLUMN IF NOT EXISTS is_internal_event boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS event_source_type text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS user_email text;

CREATE INDEX IF NOT EXISTS idx_app_events_is_internal_event ON public.app_events (is_internal_event);
CREATE INDEX IF NOT EXISTS idx_app_events_event_source_type ON public.app_events (event_source_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user_email ON public.app_events (user_email);
