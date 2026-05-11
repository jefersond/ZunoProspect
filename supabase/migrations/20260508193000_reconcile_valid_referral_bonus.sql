-- Unify referral bonus source of truth.
-- A bonus is valid only when the referrals ledger and profiles.referred_by agree.
-- profiles.buscas_saldo remains the spendable balance, but it is capped by valid earned referrals.

CREATE OR REPLACE FUNCTION public.valid_referral_bonus_available(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid_referrals AS (
    SELECT COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS earned_bonus
    FROM public.referrals r
    JOIN public.profiles referred
      ON referred.id = r.referred_user_id
     AND referred.referred_by = r.referrer_user_id
    WHERE r.referrer_user_id = p_user_id
      AND r.referrer_user_id <> r.referred_user_id
  )
  SELECT CASE
    WHEN public.is_admin(p_user_id) THEN 999999
    ELSE LEAST(
      GREATEST(COALESCE((SELECT p.buscas_saldo FROM public.profiles p WHERE p.id = p_user_id), 0), 0),
      COALESCE((SELECT earned_bonus FROM valid_referrals), 0)
    )
  END;
$$;

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
  WHERE r.referrer_user_id = p_user_id
    AND r.referrer_user_id <> r.referred_user_id;
$$;

WITH valid_referral_bonus AS (
  SELECT
    r.referrer_user_id AS user_id,
    COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS earned_bonus
  FROM public.referrals r
  JOIN public.profiles referred
    ON referred.id = r.referred_user_id
   AND referred.referred_by = r.referrer_user_id
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
    WHERE r.referrer_user_id = p.id
      AND r.referrer_user_id <> r.referred_user_id
  );

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
    user_id,
    plan_name,
    leads_limit,
    ai_limit,
    leads_used_this_month,
    ai_used_this_month,
    billing_period_start,
    billing_period_end
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

  SELECT *
  INTO v_usage
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

  SELECT
    COALESCE(us.leads_limit, 20),
    COALESCE(us.leads_used_this_month, 0)
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

GRANT EXECUTE ON FUNCTION public.valid_referral_bonus_available(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_referral_summary(uuid) TO authenticated, service_role;
