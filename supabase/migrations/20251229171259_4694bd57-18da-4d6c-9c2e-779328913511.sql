-- Remove the overly permissive UPDATE policy that allows users to modify their own subscriptions
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;

-- Add admin-only UPDATE policy (for manual intervention if needed)
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can update subscriptions" 
ON public.user_subscriptions 
FOR UPDATE 
USING (public.is_admin(auth.uid()));

-- Note: Legitimate subscription updates are handled by:
-- 1. increment_leads_used() - SECURITY DEFINER function for quota updates
-- 2. reset_monthly_leads_count() - SECURITY DEFINER function for monthly reset
-- 3. kiwify-webhook & check-pix-payment - Edge functions using service role for plan changes