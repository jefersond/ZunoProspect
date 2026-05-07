-- Harden usage RPCs so authenticated clients can only read or mutate
-- their own usage, while Edge Functions using service_role keep working.
-- Also reconciles legacy referral bonus balances against the referrals table.

CREATE OR REPLACE FUNCTION public.can_access_usage_subject(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR auth.uid() = p_user_id
      OR public.is_admin(auth.uid())
    );
$$;

WITH referral_bonus AS (
  SELECT referrer_user_id AS user_id, COALESCE(sum(bonus_searches), 0)::integer AS earned_bonus
  FROM public.referrals
  GROUP BY referrer_user_id
)
UPDATE public.profiles p
SET buscas_saldo = CASE
      WHEN public.is_admin(p.id) THEN GREATEST(COALESCE(p.buscas_saldo, 0), 999999)
      ELSE LEAST(GREATEST(COALESCE(p.buscas_saldo, 0), 0), COALESCE(rb.earned_bonus, 0))
    END,
    updated_at = now()
FROM referral_bonus rb
WHERE p.id = rb.user_id
  AND NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) > COALESCE(rb.earned_bonus, 0);

UPDATE public.profiles p
SET buscas_saldo = 0,
    updated_at = now()
WHERE NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.referrals r
    WHERE r.referrer_user_id = p.id
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
  v_profile_bonus integer;
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
        ELSE COALESCE(public.profiles.buscas_saldo, 0)
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

  SELECT COALESCE(p.buscas_saldo, 0)
  INTO v_profile_bonus
  FROM public.profiles p
  WHERE p.id = p_user_id;

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
    CASE WHEN v_is_admin THEN 999999 ELSE GREATEST(COALESCE(v_profile_bonus, 0), 0) END::integer AS leads_bonus_balance,
    CASE
      WHEN v_is_admin THEN 999999
      ELSE GREATEST(COALESCE(us.leads_limit, 20) - COALESCE(us.leads_used_this_month, 0), 0)
        + GREATEST(COALESCE(v_profile_bonus, 0), 0)
    END::integer AS leads_available_total,
    us.billing_period_end,
    v_is_admin AS is_admin
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;
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

  SELECT GREATEST(COALESCE(p.buscas_saldo, 0), 0)
  INTO v_bonus
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

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
    SET buscas_saldo = GREATEST(COALESCE(buscas_saldo, 0) - v_bonus_to_use, 0),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
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

  SELECT
    COALESCE(us.ai_limit, 3),
    COALESCE(us.ai_used_this_month, 0)
  INTO v_limit, v_used
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id
  FOR UPDATE;

  IF NOT v_is_admin AND v_used >= v_limit THEN
    RETURN false;
  END IF;

  UPDATE public.user_subscriptions
  SET ai_used_this_month = COALESCE(ai_used_this_month, 0) + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id uuid, p_count integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.increment_leads_usage(p_user_id, p_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id uuid)
RETURNS TABLE (
  plan_name text,
  leads_limit integer,
  leads_used integer,
  leads_remaining integer,
  billing_period_end timestamp with time zone,
  ai_limit integer,
  ai_used integer,
  ai_remaining integer,
  leads_bonus_balance integer,
  leads_available_total integer,
  is_admin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.plan_name,
    u.leads_limit,
    u.leads_used,
    u.leads_remaining,
    u.billing_period_end,
    u.ai_limit,
    u.ai_used,
    u.ai_remaining,
    u.leads_bonus_balance,
    u.leads_available_total,
    u.is_admin
  FROM public.ensure_user_usage(p_user_id) u;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_usage_subject(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_leads_usage(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_leads_used(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_info(uuid) TO authenticated, service_role;
