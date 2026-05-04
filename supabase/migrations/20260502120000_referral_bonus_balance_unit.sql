-- Treat profiles.buscas_saldo as referral bonus balance only.
-- The monthly free quota stays in user_subscriptions.leads_limit.

ALTER TABLE public.profiles
  ALTER COLUMN buscas_saldo SET DEFAULT 0;

UPDATE public.profiles
SET buscas_saldo = 0
WHERE buscas_saldo IS NULL;

UPDATE public.profiles p
SET buscas_saldo = 0,
    updated_at = now()
WHERE NOT public.is_admin(p.id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles referred
    WHERE referred.referred_by = p.id
  );

WITH referral_counts AS (
  SELECT referred_by AS profile_id, count(*)::integer AS valid_referrals
  FROM public.profiles
  WHERE referred_by IS NOT NULL
  GROUP BY referred_by
)
UPDATE public.profiles p
SET buscas_saldo = LEAST(p.buscas_saldo, referral_counts.valid_referrals * 100),
    updated_at = now()
FROM referral_counts
WHERE p.id = referral_counts.profile_id
  AND NOT public.is_admin(p.id)
  AND p.buscas_saldo > referral_counts.valid_referrals * 100;

ALTER TABLE public.profiles
  ALTER COLUMN buscas_saldo SET NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_user_id uuid, p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 0 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT id
  INTO referrer_id
  FROM public.profiles
  WHERE referral_code = trim(p_referral_code)
  LIMIT 1;

  IF referrer_id IS NULL OR referrer_id = p_user_id THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET referred_by = referrer_id,
      updated_at = now()
  WHERE id = p_user_id
    AND referred_by IS NULL;

  RETURN found;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com');
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

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id uuid)
RETURNS TABLE(
  plan_name text,
  leads_limit integer,
  leads_used integer,
  leads_remaining integer,
  billing_period_end timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  PERFORM public.reset_monthly_leads_count();

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 0 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  v_is_admin := public.is_admin(p_user_id);

  IF v_is_admin THEN
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
    VALUES (p_user_id, 'agencia', -1)
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'agencia',
        leads_limit = -1,
        updated_at = now();

    RETURN QUERY
    SELECT
      'admin'::text,
      -1::integer,
      COALESCE(s.leads_used_this_month, 0)::integer,
      -1::integer,
      COALESCE(s.billing_period_end, date_trunc('month', now()) + interval '1 month')
    FROM public.user_subscriptions s
    WHERE s.user_id = p_user_id;

    RETURN;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (p_user_id, 'starter', 10)
  ON CONFLICT (user_id) DO UPDATE
  SET leads_limit = COALESCE(NULLIF(public.user_subscriptions.leads_limit, 0), EXCLUDED.leads_limit),
      updated_at = now()
  WHERE public.user_subscriptions.leads_limit IS NULL
     OR public.user_subscriptions.leads_limit = 0;

  RETURN QUERY
  SELECT
    s.plan_name,
    COALESCE(NULLIF(s.leads_limit, 0), 10) AS leads_limit,
    COALESCE(s.leads_used_this_month, 0) AS leads_used,
    CASE
      WHEN s.leads_limit = -1 THEN -1
      ELSE GREATEST(COALESCE(NULLIF(s.leads_limit, 0), 10) - COALESCE(s.leads_used_this_month, 0), 0)
    END AS leads_remaining,
    s.billing_period_end
  FROM public.user_subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id uuid, p_count integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_remaining integer;
  v_bonus integer;
  v_bonus_to_use integer;
BEGIN
  IF p_count <= 0 THEN
    RETURN true;
  END IF;

  PERFORM public.reset_monthly_leads_count();

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 0 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  IF public.is_admin(p_user_id) THEN
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit, leads_used_this_month)
    VALUES (p_user_id, 'agencia', -1, p_count)
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'agencia',
        leads_limit = -1,
        leads_used_this_month = COALESCE(public.user_subscriptions.leads_used_this_month, 0) + p_count,
        updated_at = now();
    RETURN true;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (p_user_id, 'starter', 10)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT COALESCE(NULLIF(leads_limit, 0), 10), COALESCE(leads_used_this_month, 0)
  INTO v_limit, v_used
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF v_limit = -1 THEN
    UPDATE public.user_subscriptions
    SET leads_used_this_month = COALESCE(leads_used_this_month, 0) + p_count,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  v_remaining := GREATEST(v_limit - v_used, 0);
  v_bonus_to_use := GREATEST(p_count - v_remaining, 0);

  SELECT COALESCE(buscas_saldo, 0)
  INTO v_bonus
  FROM public.profiles
  WHERE id = p_user_id;

  v_bonus := COALESCE(v_bonus, 0);

  IF v_bonus_to_use > v_bonus THEN
    RETURN false;
  END IF;

  IF v_bonus_to_use > 0 THEN
    UPDATE public.profiles
    SET buscas_saldo = GREATEST(COALESCE(buscas_saldo, 0) - v_bonus_to_use, 0),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  UPDATE public.user_subscriptions
  SET leads_used_this_month = COALESCE(leads_used_this_month, 0) + p_count,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;
