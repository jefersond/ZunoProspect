-- Atualizar trigger de novo usuário para usar 30 leads
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (NEW.id, 'starter', 30);
  RETURN NEW;
END;
$function$;

-- Atualizar função de incrementar leads para usar 30 como fallback
CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id uuid, p_count integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Criar assinatura padrão com 30 leads
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
    VALUES (p_user_id, 'starter', 30);
    v_limit := 30;
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
$function$;

-- Atualizar usuários existentes do plano Starter de 10 para 30 leads
UPDATE public.user_subscriptions 
SET leads_limit = 30 
WHERE plan_name = 'starter' AND leads_limit = 10;