-- Criar tabela de assinaturas de usuários
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'starter' CHECK (plan_name IN ('starter', 'pro', 'agencia')),
  leads_limit INTEGER NOT NULL DEFAULT 10,
  leads_used_this_month INTEGER NOT NULL DEFAULT 0,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  is_annual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar assinatura padrão quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (NEW.id, 'starter', 10);
  RETURN NEW;
END;
$$;

-- Trigger para criar assinatura quando novo usuário é criado
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_subscription();

-- Função para resetar contagem de leads no início do mês
CREATE OR REPLACE FUNCTION public.reset_monthly_leads_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET 
    leads_used_this_month = 0,
    billing_period_start = date_trunc('month', now()),
    billing_period_end = date_trunc('month', now()) + interval '1 month'
  WHERE billing_period_end <= now();
END;
$$;

-- Função para incrementar contagem de leads usados
CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id UUID, p_count INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  -- Reset se necessário
  PERFORM public.reset_monthly_leads_count();
  
  -- Buscar limite e uso atual
  SELECT leads_limit, leads_used_this_month INTO v_limit, v_used
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;
  
  -- Verificar se existe assinatura
  IF NOT FOUND THEN
    -- Criar assinatura padrão
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
    VALUES (p_user_id, 'starter', 10);
    v_limit := 10;
    v_used := 0;
  END IF;
  
  -- Plano agência = ilimitado (leads_limit = -1)
  IF v_limit = -1 THEN
    UPDATE public.user_subscriptions
    SET leads_used_this_month = leads_used_this_month + p_count
    WHERE user_id = p_user_id;
    RETURN TRUE;
  END IF;
  
  -- Verificar se excede limite
  IF v_used + p_count > v_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Incrementar uso
  UPDATE public.user_subscriptions
  SET leads_used_this_month = leads_used_this_month + p_count
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Função para obter informações da assinatura
CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id UUID)
RETURNS TABLE(
  plan_name TEXT,
  leads_limit INTEGER,
  leads_used INTEGER,
  leads_remaining INTEGER,
  billing_period_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset se necessário
  PERFORM public.reset_monthly_leads_count();
  
  RETURN QUERY
  SELECT 
    s.plan_name,
    s.leads_limit,
    s.leads_used_this_month AS leads_used,
    CASE 
      WHEN s.leads_limit = -1 THEN -1 
      ELSE s.leads_limit - s.leads_used_this_month 
    END AS leads_remaining,
    s.billing_period_end
  FROM public.user_subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;