-- Adicionar campos de contexto da busca ao lead
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS proximidade_ativa boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS raio_km integer;