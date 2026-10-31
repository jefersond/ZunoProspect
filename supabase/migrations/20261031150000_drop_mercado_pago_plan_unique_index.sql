-- Migration: 20261031150000_drop_mercado_pago_plan_unique_index.sql
-- Descrição: Remove o índice único sobre provider_plan_id em mercado_pago_checkout_sessions.
-- Justificativa: Com a arquitetura de planos canônicos compartilhados (Starter, Pro, Agency),
-- múltiplos assinantes compartilham legitimamente o mesmo preapproval_plan_id.
-- A unicidade por comprador já é garantida por mercado_pago_checkout_sessions_checkout_identity_unique
-- e por mercado_pago_checkout_sessions_provider_unique (provider_subscription_id).

drop index if exists public.mercado_pago_checkout_sessions_plan_unique;
