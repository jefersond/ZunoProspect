-- Referral rewards are released only after the referred user pays for a plan.

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.referrals
SET status = CASE
      WHEN referrer_user_id = referred_user_id THEN 'rejected'
      WHEN status = 'rewarded' OR paid_at IS NOT NULL THEN 'rewarded'
      WHEN status = 'rejected' THEN 'rejected'
      ELSE 'pending'
    END,
    rejected_at = CASE
      WHEN referrer_user_id = referred_user_id THEN COALESCE(rejected_at, now())
      ELSE rejected_at
    END,
    rejection_reason = CASE
      WHEN referrer_user_id = referred_user_id THEN COALESCE(rejection_reason, 'self_referral')
      ELSE rejection_reason
    END,
    bonus_searches = CASE
      WHEN status = 'rewarded' OR paid_at IS NOT NULL THEN GREATEST(COALESCE(bonus_searches, 0), 100)
      ELSE 0
    END,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.is_paid_referral_plan(p_plan_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(COALESCE(p_plan_name, '')) IN ('starter', 'iniciante', 'pro', 'agency', 'agencia');
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
    AND r.referrer_user_id <> r.referred_user_id
    AND r.status = 'rewarded';
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
  WHERE r.referrer_user_id = p_user_id
    AND r.referrer_user_id <> r.referred_user_id
    AND r.status = 'rewarded';
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

DROP FUNCTION IF EXISTS public.grant_referral_bonus_once(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.grant_referral_bonus_once(
  p_referred_user_id uuid,
  p_referrer_user_id uuid,
  p_referral_code text
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
    bonus_searches,
    status
  )
  VALUES (
    p_referred_user_id,
    p_referrer_user_id,
    NULLIF(trim(COALESCE(p_referral_code, '')), ''),
    0,
    'pending'
  )
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.reward_referral_for_paid_plan(
  p_referred_user_id uuid,
  p_plan_name text,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_previous_status text;
BEGIN
  IF p_referred_user_id IS NULL OR NOT public.is_paid_referral_plan(p_plan_name) THEN
    RETURN false;
  END IF;

  SELECT referrer_user_id, status
  INTO v_referrer_id, v_previous_status
  FROM public.referrals
  WHERE referred_user_id = p_referred_user_id
  FOR UPDATE;

  IF v_referrer_id IS NULL OR v_referrer_id = p_referred_user_id OR v_previous_status = 'rejected' THEN
    RETURN false;
  END IF;

  UPDATE public.referrals
  SET status = 'rewarded',
      bonus_searches = GREATEST(COALESCE(bonus_searches, 0), 100),
      paid_at = COALESCE(p_paid_at, now()),
      approved_at = COALESCE(approved_at, COALESCE(p_paid_at, now())),
      updated_at = now()
  WHERE referred_user_id = p_referred_user_id;

  IF v_previous_status IS DISTINCT FROM 'rewarded' THEN
    UPDATE public.profiles
    SET buscas_saldo = GREATEST(COALESCE(buscas_saldo, 0), 0) + 100,
        updated_at = now()
    WHERE id = v_referrer_id;
  END IF;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.get_referral_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_referral_summary(p_user_id uuid)
RETURNS TABLE (
  referral_code text,
  referral_count integer,
  referral_pending_count integer,
  referral_rewarded_count integer,
  referral_rejected_count integer,
  referral_bonus_available integer,
  referral_bonus_earned integer,
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
    CASE WHEN public.is_admin(p_user_id) THEN 0 ELSE COALESCE(count(*) FILTER (WHERE r.status = 'pending'), 0) END::integer,
    CASE WHEN public.is_admin(p_user_id) THEN 999999 ELSE COALESCE(count(*) FILTER (WHERE r.status = 'rewarded'), 0) END::integer,
    CASE WHEN public.is_admin(p_user_id) THEN 0 ELSE COALESCE(count(*) FILTER (WHERE r.status = 'rejected'), 0) END::integer,
    COALESCE(v_usage.leads_bonus_balance, 0)::integer,
    CASE WHEN public.is_admin(p_user_id) THEN 999999 ELSE public.valid_referral_bonus_earned(p_user_id) END::integer,
    COALESCE(v_usage.leads_available_total, 0)::integer
  FROM public.profiles p
  LEFT JOIN public.referrals r
    ON r.referrer_user_id = p.id
  WHERE p.id = p_user_id
  GROUP BY p.id, p.referral_code, v_usage.leads_bonus_balance, v_usage.leads_available_total;
END;
$$;

WITH rewarded_bonus AS (
  SELECT r.referrer_user_id AS user_id, COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS earned_bonus
  FROM public.referrals r
  WHERE r.status = 'rewarded'
  GROUP BY r.referrer_user_id
)
UPDATE public.profiles p
SET buscas_saldo = CASE
      WHEN public.is_admin(p.id) THEN GREATEST(COALESCE(p.buscas_saldo, 0), 999999)
      ELSE LEAST(GREATEST(COALESCE(p.buscas_saldo, 0), 0), COALESCE(rb.earned_bonus, 0))
    END,
    updated_at = now()
FROM rewarded_bonus rb
WHERE p.id = rb.user_id
  AND NOT public.is_admin(p.id);

UPDATE public.profiles p
SET buscas_saldo = 0,
    updated_at = now()
WHERE NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.referrals r
    WHERE r.referrer_user_id = p.id
      AND r.status = 'rewarded'
  );

GRANT EXECUTE ON FUNCTION public.is_paid_referral_plan(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reward_referral_for_paid_plan(uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_referral_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_bonus_earned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_referral_bonus_available(uuid) TO authenticated, service_role;
