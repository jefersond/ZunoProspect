-- Fix leads_limit for all agency plan users to be truly unlimited (-1)
UPDATE user_subscriptions 
SET leads_limit = -1, updated_at = now()
WHERE plan_name = 'agencia' AND leads_limit != -1;