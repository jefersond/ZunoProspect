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
  v_old_notes_sdr_count int := 0;
  v_new_notes_sdr_count int := 0;
BEGIN
  -- Determina se o usuário da sessão autenticada é administrador real.
  -- public.is_admin() valida o auth.uid() e auth.email() do JWT assinado no banco.
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

    -- B. Preservação e Adição de NOTAS no CRM:
    -- O assinante PODE editar suas anotações comerciais mesmo se o lead contiver logs anteriores do SDR.
    -- O que é BLOQUEADO: o assinante injetar NOVOS marcadores '[SDR WhatsApp' que não existiam no OLD.notas.
    IF NEW.notas IS NOT NULL AND NEW.notas LIKE '%[SDR WhatsApp%' THEN
      v_old_notes_sdr_count := coalesce(regexp_count(coalesce(OLD.notas, ''), '\[SDR WhatsApp', 1, 'i'), 0);
      v_new_notes_sdr_count := coalesce(regexp_count(NEW.notas, '\[SDR WhatsApp', 1, 'i'), 0);

      IF v_new_notes_sdr_count > v_old_notes_sdr_count THEN
        RAISE EXCEPTION 'Acesso restrito: inserção de novos registros de log [SDR WhatsApp] é exclusiva do fluxo SDR (somente ADM).'
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
