-- Adicionar colunas CNPJ que estão faltando na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnpj_telefone_encrypted BYTEA;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnpj_email_encrypted BYTEA;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS situacao_cadastral TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS porte_empresa TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnae_principal TEXT;