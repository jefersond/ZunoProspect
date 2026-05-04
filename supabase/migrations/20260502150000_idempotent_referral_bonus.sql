-- Make referral attribution and bonus credit idempotent.
-- profiles.buscas_saldo is referral bonus balance, not the free monthly quota.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS buscas_saldo integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ALTER COLUMN buscas_saldo SET DEFAULT 0;

UPDATE public.profiles
SET buscas_saldo = 0
WHERE buscas_saldo IS NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    LOOP
      v_code := 'ref_' || substr(md5(NEW.id::text || clock_timestamp()::text || random()::text), 1, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE referral_code = v_code
          AND id <> NEW.id
      );
    END LOOP;

    NEW.referral_code := v_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_referral_code ON public.profiles;
CREATE TRIGGER ensure_referral_code
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

WITH ranked_codes AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY referral_code ORDER BY id::text) AS rn
  FROM public.profiles
  WHERE referral_code IS NOT NULL
    AND trim(referral_code) <> ''
)
UPDATE public.profiles p
SET referral_code = NULL,
    updated_at = now()
FROM ranked_codes r
WHERE p.id = r.id
  AND r.rn > 1;

UPDATE public.profiles
SET referral_code = referral_code,
    updated_at = now()
WHERE referral_code IS NULL
   OR trim(referral_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
ON public.profiles(referral_code)
WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  referred_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text,
  bonus_searches integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id
ON public.referrals(referrer_user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (
  auth.uid() = referrer_user_id
  OR auth.uid() = referred_user_id
  OR public.is_admin(auth.uid())
);

INSERT INTO public.referrals (referred_user_id, referrer_user_id, referral_code, bonus_searches)
SELECT
  referred.id,
  referred.referred_by,
  referrer.referral_code,
  100
FROM public.profiles referred
JOIN public.profiles referrer ON referrer.id = referred.referred_by
WHERE referred.referred_by IS NOT NULL
  AND referred.referred_by <> referred.id
ON CONFLICT (referred_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_referral_bonus_once(
  p_referred_user_id uuid,
  p_referrer_user_id uuid,
  p_referral_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_referred_user_id IS NULL
     OR p_referrer_user_id IS NULL
     OR p_referred_user_id = p_referrer_user_id THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET referred_by = p_referrer_user_id,
      updated_at = now()
  WHERE id = p_referred_user_id
    AND (referred_by IS NULL OR referred_by = p_referrer_user_id);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals (
    referred_user_id,
    referrer_user_id,
    referral_code,
    bonus_searches
  )
  VALUES (
    p_referred_user_id,
    p_referrer_user_id,
    NULLIF(trim(COALESCE(p_referral_code, '')), ''),
    100
  )
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100,
      updated_at = now()
  WHERE id = p_referrer_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_user_id uuid, p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_referral_code text := NULLIF(trim(COALESCE(p_referral_code, '')), '');
BEGIN
  IF p_user_id IS NULL OR v_referral_code IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN lower(COALESCE(u.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com') THEN 999999
      ELSE 0
    END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO UPDATE
  SET nome_completo = COALESCE(EXCLUDED.nome_completo, public.profiles.nome_completo),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  SELECT id
  INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = v_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL OR v_referrer_id = p_user_id THEN
    RETURN false;
  END IF;

  RETURN public.grant_referral_bonus_once(p_user_id, v_referrer_id, v_referral_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral_from_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
BEGIN
  SELECT raw_user_meta_data->>'referred_by_code'
  INTO v_referral_code
  FROM auth.users
  WHERE id = NEW.id;

  IF v_referral_code IS NOT NULL AND trim(v_referral_code) <> '' THEN
    PERFORM public.apply_referral_code(NEW.id, v_referral_code);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_reward ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update_reward ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_apply_referral ON public.profiles;
CREATE TRIGGER on_profile_created_apply_referral
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.apply_referral_from_user_metadata();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com');
  v_referral_code text := NEW.raw_user_meta_data->>'referred_by_code';
BEGIN
  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN v_is_admin THEN 999999 ELSE 0 END
  )
  ON CONFLICT (id) DO UPDATE
  SET nome_completo = COALESCE(EXCLUDED.nome_completo, public.profiles.nome_completo),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      buscas_saldo = CASE WHEN v_is_admin THEN 999999 ELSE COALESCE(public.profiles.buscas_saldo, EXCLUDED.buscas_saldo) END,
      updated_at = now();

  IF v_referral_code IS NOT NULL AND trim(v_referral_code) <> '' THEN
    PERFORM public.apply_referral_code(NEW.id, v_referral_code);
  END IF;

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com');
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (
    NEW.id,
    CASE WHEN v_is_admin THEN 'agencia' ELSE 'starter' END,
    CASE WHEN v_is_admin THEN -1 ELSE 10 END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_name = CASE WHEN v_is_admin THEN 'agencia' ELSE public.user_subscriptions.plan_name END,
      leads_limit = CASE WHEN v_is_admin THEN -1 ELSE COALESCE(NULLIF(public.user_subscriptions.leads_limit, 0), EXCLUDED.leads_limit) END,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_subscription();

UPDATE public.profiles
SET buscas_saldo = 999999,
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM auth.users
  WHERE lower(COALESCE(email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com')
);

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(COALESCE(email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
SELECT id, 'agencia', -1
FROM auth.users
WHERE lower(COALESCE(email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET plan_name = 'agencia',
    leads_limit = -1,
    updated_at = now();

GRANT SELECT ON public.referrals TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(uuid, text) TO authenticated, service_role;
