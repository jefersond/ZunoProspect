-- Diagnostic: referral bonus consistency by user.
-- Run with a privileged connection because it reads auth.users.

WITH valid_referrals AS (
  SELECT
    r.referrer_user_id AS user_id,
    count(*)::integer AS referrals_feitos_validos,
    COALESCE(sum(GREATEST(r.bonus_searches, 0)), 0)::integer AS bonus_calculado_por_referrals
  FROM public.referrals r
  JOIN public.profiles referred
    ON referred.id = r.referred_user_id
   AND referred.referred_by = r.referrer_user_id
  WHERE r.referrer_user_id <> r.referred_user_id
  GROUP BY r.referrer_user_id
),
profile_referrals AS (
  SELECT
    referred_by AS user_id,
    count(*)::integer AS profiles_referred_by_count
  FROM public.profiles
  WHERE referred_by IS NOT NULL
    AND referred_by <> id
  GROUP BY referred_by
)
SELECT
  u.email,
  p.id AS user_id,
  COALESCE(p.buscas_saldo, 0) AS profiles_buscas_saldo,
  COALESCE(pr.profiles_referred_by_count, 0) AS indicacoes_por_profiles_referred_by,
  COALESCE(vr.referrals_feitos_validos, 0) AS referrals_feitos_validos,
  COALESCE(vr.bonus_calculado_por_referrals, 0) AS bonus_calculado_por_referrals,
  LEAST(
    GREATEST(COALESCE(p.buscas_saldo, 0), 0),
    COALESCE(vr.bonus_calculado_por_referrals, 0)
  ) AS referral_bonus_available_corrigido,
  COALESCE(us.leads_limit, 20) AS leads_limit,
  COALESCE(us.leads_used_this_month, 0) AS leads_used,
  GREATEST(COALESCE(us.leads_limit, 20) - COALESCE(us.leads_used_this_month, 0), 0)
    + LEAST(
        GREATEST(COALESCE(p.buscas_saldo, 0), 0),
        COALESCE(vr.bonus_calculado_por_referrals, 0)
      ) AS leads_available_total_corrigido
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
LEFT JOIN valid_referrals vr ON vr.user_id = p.id
LEFT JOIN profile_referrals pr ON pr.user_id = p.id
ORDER BY profiles_buscas_saldo DESC, u.email;

-- Correction for users with legacy/stale profiles.buscas_saldo:
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
SET buscas_saldo = LEAST(
      GREATEST(COALESCE(p.buscas_saldo, 0), 0),
      COALESCE(vrb.earned_bonus, 0)
    ),
    updated_at = now()
FROM valid_referral_bonus vrb
WHERE p.id = vrb.user_id
  AND NOT public.is_admin(p.id)
  AND COALESCE(p.buscas_saldo, 0) <> LEAST(
    GREATEST(COALESCE(p.buscas_saldo, 0), 0),
    COALESCE(vrb.earned_bonus, 0)
  );

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
