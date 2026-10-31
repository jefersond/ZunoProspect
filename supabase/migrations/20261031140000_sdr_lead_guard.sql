-- Migration: Proteção no Banco de Dados para Módulo SDR Restrito a Administradores
-- IMPORTANTE: Preparada para lançamento (NÃO APLICADA em produção até autorização explícita)
--
-- Impede que chamadas diretas ao Supabase via SDK ou API (com JWT de assinante)
-- consigam forjar status ou logs exclusivos do SDR, mantendo o uso legítimo do CRM pelos assinantes.

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

DROP TRIGGER IF EXISTS trg_guard_sdr_lead_mutations ON public.leads;
CREATE TRIGGER trg_guard_sdr_lead_mutations
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sdr_lead_mutations();
