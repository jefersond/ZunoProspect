-- Create table for API keys (exclusive for Agency plan)
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_preview text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own keys
CREATE POLICY "Users can view their own API keys"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
ON public.api_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
ON public.api_keys
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
ON public.api_keys
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster key lookups
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);