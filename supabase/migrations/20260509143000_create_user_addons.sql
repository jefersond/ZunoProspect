CREATE TABLE IF NOT EXISTS public.user_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addon_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  provider text NOT NULL DEFAULT 'stripe',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, addon_id)
);

ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own addons" ON public.user_addons;
CREATE POLICY "Users can read own addons"
ON public.user_addons
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON public.user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_stripe_subscription_id
ON public.user_addons(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_user_addons_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_addons_updated_at ON public.user_addons;
CREATE TRIGGER update_user_addons_updated_at
BEFORE UPDATE ON public.user_addons
FOR EACH ROW
EXECUTE FUNCTION public.update_user_addons_updated_at();

INSERT INTO public.user_addons (
  user_id,
  addon_id,
  status,
  provider,
  activated_at,
  cancelled_at
)
SELECT
  user_id,
  'us_prospecting',
  'active',
  'kiwify',
  COALESCE(usa_addon_active_until, now()),
  NULL
FROM public.user_subscriptions
WHERE usa_addon = true
  AND (usa_addon_active_until IS NULL OR usa_addon_active_until > now())
ON CONFLICT (user_id, addon_id)
DO UPDATE SET
  status = 'active',
  provider = COALESCE(public.user_addons.provider, 'kiwify'),
  cancelled_at = NULL,
  updated_at = now();
