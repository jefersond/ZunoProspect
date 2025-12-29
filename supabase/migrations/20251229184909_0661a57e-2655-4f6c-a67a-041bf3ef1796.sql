-- Create leads access audit log table
CREATE TABLE public.leads_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('list', 'view_detail', 'export', 'search')),
  lead_ids uuid[] DEFAULT NULL,
  leads_count integer DEFAULT 0,
  ip_address text DEFAULT NULL,
  user_agent text DEFAULT NULL,
  request_params jsonb DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for querying by user and time
CREATE INDEX idx_leads_access_log_user_time ON public.leads_access_log(user_id, created_at DESC);

-- Create index for rate limiting queries
CREATE INDEX idx_leads_access_log_rate_limit ON public.leads_access_log(user_id, created_at);

-- Enable RLS
ALTER TABLE public.leads_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view access logs
CREATE POLICY "Admins can view access logs" 
ON public.leads_access_log 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Service role can insert logs (edge functions use service role)
-- No insert policy for authenticated users - only service role can insert

-- Create rate limiting helper function
CREATE OR REPLACE FUNCTION public.check_leads_rate_limit(
  p_user_id uuid,
  p_max_requests integer DEFAULT 30,
  p_window_minutes integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count integer;
  v_window_start timestamp with time zone;
  v_is_allowed boolean;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Count requests in the window
  SELECT COUNT(*) INTO v_request_count
  FROM public.leads_access_log
  WHERE user_id = p_user_id
    AND created_at >= v_window_start
    AND action_type IN ('list', 'search');
  
  v_is_allowed := v_request_count < p_max_requests;
  
  RETURN jsonb_build_object(
    'allowed', v_is_allowed,
    'current_count', v_request_count,
    'limit', p_max_requests,
    'window_minutes', p_window_minutes,
    'remaining', GREATEST(0, p_max_requests - v_request_count)
  );
END;
$$;

-- Create function to log access
CREATE OR REPLACE FUNCTION public.log_leads_access(
  p_user_id uuid,
  p_action_type text,
  p_lead_ids uuid[] DEFAULT NULL,
  p_leads_count integer DEFAULT 0,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_request_params jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.leads_access_log (
    user_id,
    action_type,
    lead_ids,
    leads_count,
    ip_address,
    user_agent,
    request_params
  ) VALUES (
    p_user_id,
    p_action_type,
    p_lead_ids,
    p_leads_count,
    p_ip_address,
    p_user_agent,
    p_request_params
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;