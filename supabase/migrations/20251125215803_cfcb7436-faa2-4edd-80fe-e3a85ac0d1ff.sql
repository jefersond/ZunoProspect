-- Adiciona campo 'salvo' na tabela leads para permitir preservar leads entre buscas
ALTER TABLE public.leads ADD COLUMN salvo boolean DEFAULT false;

-- Adiciona índice para melhorar performance de queries com filtro por 'salvo'
CREATE INDEX idx_leads_salvo ON public.leads(salvo);