-- SCRIPT DE RECUPERAÇÃO RETROATIVA DE PLANO DO CLIENTE
-- Execute diretamente no Supabase SQL Editor para corrigir a conta do cliente que já pagou.
-- Substitua 'email_do_cliente@exemplo.com' pelo e-mail real do cliente que comprou no Stripe.
-- Substitua 'starter' | 'pro' | 'agencia' pelo ID do plano contratado pelo cliente.

DO $$
DECLARE
  v_email text := 'email_do_cliente@exemplo.com'; -- <<< ALTERE AQUI O EMAIL DO CLIENTE
  v_plan_id text := 'pro';                       -- <<< ALTERE AQUI PARA O PLANO ('starter', 'pro', 'agencia')
  
  v_user_id uuid;
  v_leads_limit integer;
  v_ai_limit integer;
  v_billing_period_end timestamptz;
BEGIN
  -- 1. Obter o user_id a partir do e-mail no auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com o e-mail % não foi encontrado no sistema.', v_email;
  END IF;

  -- 2. Definir os limites corretos
  IF v_plan_id = 'starter' THEN
    v_leads_limit := 300;
    v_ai_limit := 30;
  ELSIF v_plan_id = 'pro' THEN
    v_leads_limit := 800;
    v_ai_limit := 100;
  ELSIF v_plan_id = 'agencia' OR v_plan_id = 'agency' THEN
    v_plan_id := 'agencia';
    v_leads_limit := 2000;
    v_ai_limit := 300;
  ELSE
    RAISE EXCEPTION 'Plano % é inválido. Use starter, pro ou agencia.', v_plan_id;
  END IF;

  -- Definir fim do período de faturamento para daqui a 1 mês
  v_billing_period_end := now() + interval '1 month';

  -- 3. Fazer upsert na tabela public.user_subscriptions
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_name,
    leads_limit,
    ai_limit,
    leads_used_this_month,
    ai_used_this_month,
    billing_period_start,
    billing_period_end,
    subscription_status,
    billing_cycle,
    updated_at
  )
  VALUES (
    v_user_id,
    v_plan_id,
    v_leads_limit,
    v_ai_limit,
    0,
    0,
    now(),
    v_billing_period_end,
    'active',
    'monthly',
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_name = EXCLUDED.plan_name,
      leads_limit = EXCLUDED.leads_limit,
      ai_limit = EXCLUDED.ai_limit,
      billing_period_start = EXCLUDED.billing_period_start,
      billing_period_end = EXCLUDED.billing_period_end,
      subscription_status = EXCLUDED.subscription_status,
      billing_cycle = EXCLUDED.billing_cycle,
      updated_at = now();

  -- 4. Registrar evento retroativo de pagamento para fins de auditoria
  INSERT INTO public.payment_events (
    user_id,
    event_type,
    provider,
    provider_event_id,
    plan_name,
    status,
    event_data,
    created_at
  )
  VALUES (
    v_user_id,
    'manual_retroactive_activation',
    'stripe',
    'manual_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substring(v_user_id::text, 1, 8),
    v_plan_id,
    'paid',
    jsonb_build_object(
      'description', 'Plano ativado manualmente por script de resgate de pagamento',
      'email', v_email,
      'plan_id', v_plan_id,
      'leads_limit', v_leads_limit,
      'ai_limit', v_ai_limit
    ),
    now()
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING;

  -- 5. Registrar evento de aplicativo correspondente
  INSERT INTO public.app_events (
    user_id,
    event_type,
    event_name,
    event_data,
    metadata,
    user_agent
  )
  VALUES (
    v_user_id,
    'Payment_Plan_Activated',
    'Payment_Plan_Activated',
    jsonb_build_object('stripe_event_id', 'manual', 'plan_id', v_plan_id, 'manual_activation', true),
    jsonb_build_object('stripe_event_id', 'manual', 'plan_id', v_plan_id, 'manual_activation', true),
    'admin-manual-script'
  );

  RAISE NOTICE 'Plano % (Leads: %, IA: %) ativado manualmente com sucesso para o usuário % (%)!', v_plan_id, v_leads_limit, v_ai_limit, v_user_id, v_email;
END $$;
