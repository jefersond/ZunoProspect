-- ==============================================================================
-- Proposta de Proteção no Banco de Dados: Módulo SDR Restrito a Administradores
-- Arquivo: docs/proposals/sdr-lead-guard.sql
-- Status: PROPOSTA TÉCNICA (NÃO APLICADA - aguardando autorização)
-- ==============================================================================
--
-- OBJETIVO:
-- Impedir que chamadas diretas ao Supabase via SDK ou API (com JWT de assinante)
-- consigam forjar status ou logs exclusivos do SDR em testes, SEM PREJUDICAR
-- o uso legítimo do CRM pelos assinantes (edições de notas e troca de status).
--
-- PRINCÍPIOS DE SEGURANÇA:
-- 1. Não confia em metadados do cliente ou parâmetros arbitrários.
-- 2. Utiliza exclusivamente public.is_admin() baseado na sessão auth.uid() do Postgres.
-- 3. Trata INSERT e UPDATE.
-- 4. Permite ao assinante editar notas e status em leads que já contêm histórico antigo do SDR.

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
  -- Determina se o usuário da sessão autenticada é administrador real.
  -- public.is_admin() (sem argumentos) valida o auth.uid() e auth.email() do JWT assinado no banco.
  v_is_admin := public.is_admin();

  -- Se for administrador autenticado, todas as operações do SDR são liberadas.
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 1. Regras para INSERT
  IF TG_OP = 'INSERT' THEN
    -- Assinante comum não pode criar lead com status exclusivo do SDR
    IF NEW.status = 'abertura_iniciada' THEN
      RAISE EXCEPTION 'Acesso restrito: o status abertura_iniciada é exclusivo do fluxo SDR em testes (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    -- Assinante comum não pode forjar tags de log do SDR em notas
    IF NEW.notas IS NOT NULL AND NEW.notas LIKE '%[SDR WhatsApp%' THEN
      RAISE EXCEPTION 'Acesso restrito: marcadores [SDR WhatsApp] são exclusivos do fluxo SDR em testes (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- 2. Regras para UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- A. Transição de STATUS:
    -- Bloqueia apenas se o novo status for 'abertura_iniciada' E o status anterior NÃO era 'abertura_iniciada'.
    -- Se o lead já estava em 'abertura_iniciada' e o assinante avança para 'em_contato' ou 'fechado', É PERMITIDO.
    IF NEW.status = 'abertura_iniciada' AND (OLD.status IS DISTINCT FROM 'abertura_iniciada') THEN
      RAISE EXCEPTION 'Acesso restrito: a transição para o status abertura_iniciada é exclusiva do fluxo SDR em testes (somente ADM).'
        USING ERRCODE = '42501';
    END IF;

    -- B. Preservação estrita de NOTAS no CRM (Proteção contra bypass por substituição e forja):
    -- Extrai todas as entradas de log do SDR de OLD e NEW.
    -- Se qualquer entrada de SDR for inserida, adulterada ou substituída (mesmo mantendo a contagem igual), bloqueia.
    -- Edições em anotações normais do CRM mantêm as linhas de SDR intactas e são 100% permitidas.
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

-- Aplicação do Trigger (somente quando autorizada a migration)
DROP TRIGGER IF EXISTS trg_guard_sdr_lead_mutations ON public.leads;
CREATE TRIGGER trg_guard_sdr_lead_mutations
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sdr_lead_mutations();
