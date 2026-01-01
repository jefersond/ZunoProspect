-- Create email_queue table for n8n integration
CREATE TABLE public.email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  user_id UUID
);

-- Create indexes for performance
CREATE INDEX idx_email_queue_status ON public.email_queue(status);
CREATE INDEX idx_email_queue_created_at ON public.email_queue(created_at);
CREATE INDEX idx_email_queue_email_type ON public.email_queue(email_type);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Policies: Only service role and admins can access
CREATE POLICY "Service role full access on email_queue"
  ON public.email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view email_queue"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Block direct access for regular users
CREATE POLICY "Block authenticated insert on email_queue"
  ON public.email_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Block authenticated update on email_queue"
  ON public.email_queue
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Block authenticated delete on email_queue"
  ON public.email_queue
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));