-- Fix usage/referral source of truth.
-- Diagnostic before/after:
-- WITH valid_referrals AS (
--   SELECT r.referrer_user_id AS user_id, count(*)::integer AS referral_count,
--          COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS earned_bonus
--   FROM public.referrals r
--   JOIN public.profiles referred ON referred.id = r.referred_user_id
--    AND referred.referred_by = r.referrer_user_id
--   JOIN auth.users referred_auth ON referred_auth.id = r.referred_user_id
--    AND referred_auth.confirmed_at IS NOT NULL
--   WHERE r.referrer_user_id <> r.referred_user_id
--   GROUP BY r.referrer_user_id
-- )
-- SELECT p.id, u.email, p.buscas_saldo, COALESCE(vr.referral_count, 0) AS valid_referrals,
--        COALESCE(vr.earned_bonus, 0) AS expected_bonus
-- FROM public.profiles p
-- LEFT JOIN auth.users u ON u.id = p.id
-- LEFT JOIN valid_referrals vr ON vr.user_id = p.id
-- WHERE COALESCE(p.buscas_saldo, 0) > 0
-- ORDER BY p.buscas_saldo DESC;

CREATE OR REPLACE FUNCTION public.valid_referral_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.referrals r
  JOIN public.profiles referred
    ON referred.id = r.referred_user_id
   AND referred.referred_by = r.referrer_user_id
  JOIN auth.users referred_auth
    ON referred_auth.id = r.referred_user_id
   AND referred_auth.confirmed_at IS NOT NULL
  WHERE r.referrer_user_id = p_user_id
    AND r.referrer_user_id <> r.referred_user_id;
$$;

CREATE OR REPLACE FUNCTION public.valid_referral_bonus_earned(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer
  FROM public.referrals r
  JOIN public.profiles referred
    ON referred.id = r.referred_user_id
   AND referred.referred_by = r.referrer_user_id
  JOIN auth.users referred_auth
    ON referred_auth.id = r.referred_user_id
   AND referred_auth.confirmed_at IS NOT NULL
  WHERE r.referrer_user_id = p_user_id
    AND r.referrer_user_id <> r.referred_user_id;
$$;

CREATE OR REPLACE FUNCTION public.valid_referral_bonus_available(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin(p_user_id) THEN 999999
    ELSE LEAST(
      GREATEST(COALESCE((SELECT p.buscas_saldo FROM public.profiles p WHERE p.id = p_user_id), 0), 0),
      COALESCE(public.valid_referral_bonus_earned(p_user_id), 0)
    )
  END;
$$;

WITH valid_referral_bonus AS (
  SELECT
    r.referrer_user_id AS user_id,
    COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS earned_bonus
  FROM public.referrals r
  JOIN public.profiles referred
    ON referred.id = r.referred_user_id
   AND referred.referred_by = r.referrer_user_id
  JOIN auth.users referred_auth
    ON referred_auth.id = r.referred_user_id
   AND referred_auth.confirmed_at IS NOT NULL
  WHERE r.referrer_user_id <> r.referred_user_id
  GROUP BY r.referrer_user_id
)
UPDATE public.profiles p
SET buscas_saldo = CASE
      WHEN public.is_admin(p.id) THEN GREATEST(COALESCE(p.buscas_saldo, 0), 999999)
      ELSE LEAST(GREATEST(COALESCE(p.buscas_saldo, 0), 0), COALESCE(vrb.earned_bonus, 0))
    END,
    updated_at = now()
FROM valid_referral_bonus vrb
WHERE p.id = vrb.user_id
  AND NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) <> LEAST(GREATEST(COALESCE(p.buscas_saldo, 0), 0), COALESCE(vrb.earned_bonus, 0));

UPDATE public.profiles p
SET buscas_saldo = 0,
    updated_at = now()
WHERE NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.referrals r
    JOIN public.profiles referred
      ON referred.id = r.referred_user_id
     AND referred.referred_by = r.referrer_user_id
    JOIN auth.users referred_auth
      ON referred_auth.id = r.referred_user_id
     AND referred_auth.confirmed_at IS NOT NULL
    WHERE r.referrer_user_id = p.id
      AND r.referrer_user_id <> r.referred_user_id
  );

-- Explicit legacy/test cleanup for the account diagnosed as 20 free + 200 legacy referral balance.
UPDATE public.profiles
SET buscas_saldo = 0,
    updated_at = now()
WHERE id = '5e2c4f04-c2c8-481f-addf-3858f1e405dc'::uuid;

DELETE FROM public.referrals
WHERE referrer_user_id = '5e2c4f04-c2c8-481f-addf-3858f1e405dc'::uuid;

CREATE OR REPLACE FUNCTION public.ensure_user_usage(p_user_id uuid)
RETURNS TABLE (
  plan_name text,
  leads_limit integer,
  leads_used integer,
  leads_remaining integer,
  ai_limit integer,
  ai_used integer,
  ai_remaining integer,
  leads_bonus_balance integer,
  leads_available_total integer,
  billing_period_end timestamp with time zone,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin(p_user_id);
  v_plan text;
  v_bonus_available integer;
BEGIN
  IF NOT public.can_access_usage_subject(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed to access usage for this user';
  END IF;

  PERFORM public.reset_monthly_leads_count();

  INSERT INTO public.profiles (id, buscas_saldo)
  VALUES (p_user_id, CASE WHEN v_is_admin THEN 999999 ELSE 0 END)
  ON CONFLICT (id) DO UPDATE
  SET buscas_saldo = CASE
        WHEN v_is_admin THEN GREATEST(COALESCE(public.profiles.buscas_saldo, 0), 999999)
        ELSE public.valid_referral_bonus_available(p_user_id)
      END,
      updated_at = now();

  INSERT INTO public.user_subscriptions (
    user_id, plan_name, leads_limit, ai_limit, leads_used_this_month,
    ai_used_this_month, billing_period_start, billing_period_end
  )
  VALUES (
    p_user_id,
    CASE WHEN v_is_admin THEN 'agencia' ELSE 'free' END,
    CASE WHEN v_is_admin THEN 999999 ELSE 20 END,
    CASE WHEN v_is_admin THEN 999999 ELSE 3 END,
    0,
    0,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT public.normalize_plan_name(us.plan_name)
  INTO v_plan
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  IF v_is_admin THEN
    v_plan := 'agencia';
  END IF;

  UPDATE public.user_subscriptions us
  SET plan_name = v_plan,
      leads_limit = public.plan_leads_limit(v_plan, v_is_admin),
      ai_limit = public.plan_ai_limit(v_plan, v_is_admin),
      leads_used_this_month = GREATEST(COALESCE(us.leads_used_this_month, 0), 0),
      ai_used_this_month = GREATEST(COALESCE(us.ai_used_this_month, 0), 0),
      billing_period_start = COALESCE(us.billing_period_start, date_trunc('month', now())),
      billing_period_end = COALESCE(us.billing_period_end, date_trunc('month', now()) + interval '1 month'),
      updated_at = now()
  WHERE us.user_id = p_user_id;

  v_bonus_available := public.valid_referral_bonus_available(p_user_id);

  RETURN QUERY
  SELECT
    CASE WHEN v_is_admin THEN 'admin' ELSE us.plan_name END::text AS plan_name,
    CASE WHEN v_is_admin THEN 999999 ELSE COALESCE(us.leads_limit, 20) END::integer AS leads_limit,
    COALESCE(us.leads_used_this_month, 0)::integer AS leads_used,
    CASE
      WHEN v_is_admin THEN 999999
      ELSE GREATEST(COALESCE(us.leads_limit, 20) - COALESCE(us.leads_used_this_month, 0), 0)
    END::integer AS leads_remaining,
    CASE WHEN v_is_admin THEN 999999 ELSE COALESCE(us.ai_limit, 3) END::integer AS ai_limit,
    COALESCE(us.ai_used_this_month, 0)::integer AS ai_used,
    CASE
      WHEN v_is_admin THEN 999999
      ELSE GREATEST(COALESCE(us.ai_limit, 3) - COALESCE(us.ai_used_this_month, 0), 0)
    END::integer AS ai_remaining,
    CASE WHEN v_is_admin THEN 999999 ELSE GREATEST(COALESCE(v_bonus_available, 0), 0) END::integer AS leads_bonus_balance,
    CASE
      WHEN v_is_admin THEN 999999
      ELSE GREATEST(COALESCE(us.leads_limit, 20) - COALESCE(us.leads_used_this_month, 0), 0)
        + GREATEST(COALESCE(v_bonus_available, 0), 0)
    END::integer AS leads_available_total,
    us.billing_period_end,
    v_is_admin AS is_admin
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_usage()
RETURNS TABLE (
  plan text,
  leads_limit integer,
  leads_used integer,
  leads_bonus_balance integer,
  leads_available_total integer,
  ai_limit integer,
  ai_used integer,
  ai_available_total integer,
  billing_period_end timestamp with time zone,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    u.plan_name AS plan,
    u.leads_limit,
    u.leads_used,
    u.leads_bonus_balance,
    u.leads_available_total,
    u.ai_limit,
    u.ai_used,
    u.ai_remaining AS ai_available_total,
    u.billing_period_end,
    u.is_admin
  FROM public.ensure_user_usage(v_user_id) u;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_referral_summary(p_user_id uuid)
RETURNS TABLE (
  referral_code text,
  referral_count integer,
  referral_bonus_available integer,
  leads_available_total integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage record;
BEGIN
  IF NOT public.can_access_usage_subject(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed to access referrals for this user';
  END IF;

  SELECT * INTO v_usage
  FROM public.ensure_user_usage(p_user_id)
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.referral_code,
    CASE WHEN public.is_admin(p_user_id) THEN 999999 ELSE public.valid_referral_count(p_user_id) END::integer,
    COALESCE(v_usage.leads_bonus_balance, 0)::integer,
    COALESCE(v_usage.leads_available_total, 0)::integer
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_leads_usage(p_user_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin(p_user_id);
  v_limit integer;
  v_used integer;
  v_bonus integer;
  v_plan_to_use integer;
  v_bonus_to_use integer;
  v_amount integer := COALESCE(p_amount, 0);
BEGIN
  IF NOT public.can_access_usage_subject(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed to update usage for this user';
  END IF;

  IF v_amount <= 0 THEN
    RETURN true;
  END IF;

  PERFORM public.ensure_user_usage(p_user_id);

  IF v_is_admin THEN
    UPDATE public.user_subscriptions
    SET leads_used_this_month = GREATEST(COALESCE(leads_used_this_month, 0), 0) + v_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  SELECT COALESCE(us.leads_limit, 20), COALESCE(us.leads_used_this_month, 0)
  INTO v_limit, v_used
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id
  FOR UPDATE;

  SELECT public.valid_referral_bonus_available(p_user_id)
  INTO v_bonus;

  v_plan_to_use := LEAST(v_amount, GREATEST(v_limit - v_used, 0));
  v_bonus_to_use := v_amount - v_plan_to_use;

  IF v_bonus_to_use > COALESCE(v_bonus, 0) THEN
    RETURN false;
  END IF;

  UPDATE public.user_subscriptions
  SET leads_used_this_month = LEAST(v_limit, v_used + v_plan_to_use),
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_bonus_to_use > 0 THEN
    UPDATE public.profiles
    SET buscas_saldo = GREATEST(public.valid_referral_bonus_available(p_user_id) - v_bonus_to_use, 0),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id uuid, p_count integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.increment_leads_usage(p_user_id, p_count);
$$;

CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin(p_user_id);
  v_limit integer;
  v_used integer;
BEGIN
  IF NOT public.can_access_usage_subject(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed to update usage for this user';
  END IF;

  PERFORM public.ensure_user_usage(p_user_id);

  IF v_is_admin THEN
    UPDATE public.user_subscriptions
    SET ai_used_this_month = GREATEST(COALESCE(ai_used_this_month, 0), 0) + 1,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  SELECT COALESCE(us.ai_limit, 3), COALESCE(us.ai_used_this_month, 0)
  INTO v_limit, v_used
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id
  FOR UPDATE;

  IF v_used >= v_limit THEN
    RETURN false;
  END IF;

  UPDATE public.user_subscriptions
  SET ai_used_this_month = v_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.valid_referral_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_bonus_earned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_bonus_available(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_leads_usage(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_leads_used(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid) TO authenticated, service_role;
