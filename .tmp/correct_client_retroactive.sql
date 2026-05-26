-- =====================================================================================
-- SCRIPT DE CORREÇÃO EMERGENCIAL E RETROATIVA - ZUNO PROPECT
-- PROJETO: ihtltqxxlvbsxbiacbpr
-- OBJETIVO: Ativar a assinatura 'Pro' do cliente real, corrigir divergência de plano,
--           e registrar eventos no painel de Atividade ao vivo / Tempo Real.
-- =====================================================================================

BEGIN;

-- 0. GARANTIR QUE AS COLUNAS DO STRIPE EXISTAM NA TABELA DE ASSINATURAS
-- Executa a criação das colunas caso a migração do Stripe ainda não tenha sido rodada na nuvem.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_cycle text;

-- 1. IDENTIFICAÇÃO DO USUÁRIO E ATUALIZAÇÃO DA ASSINATURA 'PRO'
-- Atualiza a tabela user_subscriptions para o plano 'pro' com limites oficiais
-- (800 leads e 100 análises de IA) e status 'active', preenchendo os dados do Stripe.
INSERT INTO public.user_subscriptions (
  user_id, plan_name, leads_limit, ai_limit, leads_used_this_month, ai_used_this_month, 
  billing_period_start, billing_period_end, subscription_status, stripe_customer_id, 
  stripe_subscription_id, stripe_price_id, billing_cycle, updated_at
)
VALUES (
  'b133f74a-863f-4f44-98f8-b4505822fac0'::uuid, 
  'pro', 
  800, 
  100, 
  0, 
  0, 
  '2026-05-25T17:39:22Z'::timestamptz, 
  ('2026-05-25T17:39:22Z'::timestamptz + interval '1 month'),
  'active', 
  'cus_UaAJZtbMx68Omf', 
  'sub_1TazyQFgIIQ1aOHHElbp8uTC', 
  'price_1Tazy0FgIIQ1aOHHT0IHZiH8',
  'monthly', 
  now()
)
ON CONFLICT (user_id) DO UPDATE
SET plan_name = 'pro',
    leads_limit = 800,
    ai_limit = 100,
    subscription_status = 'active',
    stripe_customer_id = 'cus_UaAJZtbMx68Omf',
    stripe_subscription_id = 'sub_1TazyQFgIIQ1aOHHElbp8uTC',
    stripe_price_id = 'price_1Tazy0FgIIQ1aOHHT0IHZiH8',
    billing_cycle = 'monthly',
    updated_at = now();

-- 2. AJUSTE DO SALDO NO PERFIL DO USUÁRIO
-- Garante que o buscas_saldo no perfil está zerado (revogando qualquer saldo de admin/agencia
-- anterior que estivesse como 999999 ou inconsistente)
UPDATE public.profiles
SET buscas_saldo = 0,
    updated_at = now()
WHERE id = 'b133f74a-863f-4f44-98f8-b4505822fac0'::uuid;

-- 3. REMOÇÃO DE ROLE ADMINISTRATIVA INCOMPATÍVEL
-- Remove a role de admin do usuário na tabela user_roles, garantindo que ele seja
-- exibido corretamente como cliente Pro padrão sem privilégios de administração.
DELETE FROM public.user_roles
WHERE user_id = 'b133f74a-863f-4f44-98f8-b4505822fac0'::uuid 
  AND role = 'admin'::public.app_role;

-- 4. REGISTRO RETROATIVO DE EVENTO DE PAGAMENTO (Idempotência e Auditoria)
-- Registra o evento de pagamento na tabela payment_events
INSERT INTO public.payment_events (
  user_id, event_type, provider, provider_event_id, stripe_customer_id, 
  stripe_subscription_id, stripe_checkout_session_id, plan_name, amount, currency, status, created_at
)
VALUES (
  'b133f74a-863f-4f44-98f8-b4505822fac0'::uuid,
  'checkout.session.completed',
  'stripe',
  'evt_retroactive_pro_kieffer',
  'cus_UaAJZtbMx68Omf',
  'sub_1TazyQFgIIQ1aOHHElbp8uTC',
  'cs_live_b1kPcnLSGhhi1tBP4Aruz9LaxQ2PqgsQBGmuV3QJZqO5qNkMVLIETII37v',
  'pro',
  9700,
  'brl',
  'paid',
  '2026-05-25T17:39:22Z'::timestamptz
)
ON CONFLICT (provider, provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING;

-- 5. REGISTRO RETROATIVO DE COMPRA (Funil analítico e Tempo Real)
-- Cria o evento purchase_completed em app_events para que o cliente apareça na timeline
-- da Jornada do Usuário e seja contabilizado no painel de atividades e no funil.
INSERT INTO public.app_events (
  user_id, email, event_type, event_name, event_data, metadata, user_agent, is_internal_event, event_source_type, created_at
)
VALUES (
  'b133f74a-863f-4f44-98f8-b4505822fac0'::uuid,
  'falecom@klsalescompany.com',
  'purchase_completed',
  'purchase_completed',
  '{
    "plan_id": "pro",
    "plan_name": "Pro",
    "value": 97.00,
    "currency": "BRL",
    "stripe_price_id": "price_1Tazy0FgIIQ1aOHHT0IHZiH8",
    "stripe_subscription_id": "sub_1TazyQFgIIQ1aOHHElbp8uTC",
    "stripe_checkout_session_id": "cs_live_b1kPcnLSGhhi1tBP4Aruz9LaxQ2PqgsQBGmuV3QJZqO5qNkMVLIETII37v",
    "source": "stripe_webhook",
    "plan_resolution_source": "stripe_price_id",
    "has_plan_conflict": false
  }'::jsonb,
  '{
    "plan_id": "pro",
    "plan_name": "Pro",
    "value": 97.00,
    "currency": "BRL",
    "stripe_price_id": "price_1Tazy0FgIIQ1aOHHT0IHZiH8",
    "stripe_subscription_id": "sub_1TazyQFgIIQ1aOHHElbp8uTC",
    "stripe_checkout_session_id": "cs_live_b1kPcnLSGhhi1tBP4Aruz9LaxQ2PqgsQBGmuV3QJZqO5qNkMVLIETII37v",
    "source": "stripe_webhook",
    "plan_resolution_source": "stripe_price_id",
    "has_plan_conflict": false
  }'::jsonb,
  'stripe-webhook-retroactive',
  false,
  'real',
  '2026-05-25T17:39:22Z'::timestamptz
);

COMMIT;
