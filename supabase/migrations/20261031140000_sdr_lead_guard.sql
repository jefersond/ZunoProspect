-- Migration 3/3: Proteção no Banco de Dados para Módulo SDR Restrito a Administradores
-- Ordem de aplicação: 3ª (após a tabela public.leads e a função public.is_admin() já existirem)
-- Impacto em dados existentes: Zero (não altera registros existentes; permite a assinantes comuns editarem leads que já possuam histórico antigo do SDR desde que preservem as linhas [SDR WhatsApp] intactas).
--
-- Rollback (Reversibilidade):
--   DROP TRIGGER IF EXISTS trg_guard_sdr_lead_mutations ON public.leads;
--   DROP FUNCTION IF EXISTS public.guard_sdr_lead_mutations();
--   ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
--   ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY['novo'::text, 'em_contato'::text, 'qualificacao'::text, 'negociacao'::text, 'convertido'::text, 'perdido'::text, 'contatado'::text, 'qualificado'::text, 'descartado'::text]));

-- 1. Alinha a check constraint da tabela leads para aceitar o status 'abertura_iniciada'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status = ANY (ARRAY[
  'novo'::text, 
  'em_contato'::text, 
  'qualificacao'::text, 
  'negociacao'::text, 
  'convertido'::text, 
  'perdido'::text,
  'contatado'::text, 
  'qualificado'::text, 
  'descartado'::text,
  'abertura_iniciada'::text
]));

-- 2. Trigger de segurança que restringe abertura_iniciada, foco zuno_internal_prospecting e marcadores [SDR WhatsApp] exclusivamente a administradores
CREATE OR REPLACE FUNCTION public.guard_sdr_lead_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
  v_old_sdr_lines text[];
  v_new_sdr_lines text[];
BEGIN
  -- Valida a sessão autenticada no banco de dados através da RPC canônica is_admin()
  v_is_admin := public.is_admin();

  -- Se for administrador autenticado, operações do SDR são liberadas
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 1. Regras para INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.foco = 'zuno_internal_prospecting' THEN
      RAISE EXCEPTION 'Acesso restrito: o foco zuno_internal_prospecting é exclusivo do fluxo SDR (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'abertura_iniciada' THEN
      RAISE EXCEPTION 'Acesso restrito: o status abertura_iniciada é exclusivo do fluxo SDR (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.notas IS NOT NULL AND NEW.notas LIKE '%[SDR WhatsApp%' THEN
      RAISE EXCEPTION 'Acesso restrito: marcadores [SDR WhatsApp] são exclusivos do fluxo SDR (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- 2. Regras para UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.foco = 'zuno_internal_prospecting' AND (OLD.foco IS DISTINCT FROM 'zuno_internal_prospecting') THEN
      RAISE EXCEPTION 'Acesso restrito: o foco zuno_internal_prospecting é exclusivo do fluxo SDR (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    -- Bloqueia se o novo status for 'abertura_iniciada' e o status anterior NÃO era 'abertura_iniciada'
    IF NEW.status = 'abertura_iniciada' AND (OLD.status IS DISTINCT FROM 'abertura_iniciada') THEN
      RAISE EXCEPTION 'Acesso restrito: a transição para o status abertura_iniciada é exclusiva do fluxo SDR (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    -- Preservação de notas no CRM: assinante comum não pode injetar nem alterar tags [SDR WhatsApp]
    IF (OLD.notas IS NOT NULL AND OLD.notas LIKE '%[SDR WhatsApp%') OR (NEW.notas IS NOT NULL AND NEW.notas LIKE '%[SDR WhatsApp%') THEN
      SELECT coalesce(array_agg(m[1]), '{}')
      INTO v_old_sdr_lines
      FROM regexp_matches(coalesce(OLD.notas, ''), '\[SDR WhatsApp[^\r\n]*', 'g') AS m;

      SELECT coalesce(array_agg(m[1]), '{}')
      INTO v_new_sdr_lines
      FROM regexp_matches(coalesce(NEW.notas, ''), '\[SDR WhatsApp[^\r\n]*', 'g') AS m;

      IF v_old_sdr_lines IS DISTINCT FROM v_new_sdr_lines THEN
        RAISE EXCEPTION 'Acesso restrito: registros de log [SDR WhatsApp] não podem ser inseridos, alterados ou forjados por assinantes comuns.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_sdr_lead_mutations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_sdr_lead_mutations() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_sdr_lead_mutations ON public.leads;
CREATE TRIGGER trg_guard_sdr_lead_mutations
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sdr_lead_mutations();
