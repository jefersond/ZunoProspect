-- Adicionar campos para análise de IA dos leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS diagnostico_bullets jsonb,
ADD COLUMN IF NOT EXISTS probabilidade_conversao integer,
ADD COLUMN IF NOT EXISTS plano_prospeccao jsonb,
ADD COLUMN IF NOT EXISTS ai_analise_gerada_em timestamp with time zone;