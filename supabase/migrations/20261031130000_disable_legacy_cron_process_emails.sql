-- Migration 2/3: Desativação segura de cron job legado com endpoint obsoleto
-- Ordem de aplicação: 2ª (independente das demais migrations; interrompe chamadas 404 horárias)
-- Impacto em dados existentes: Zero (apenas remove agendamento ativo em cron.job se existir).
--
-- O job 'process-email-queue-cron' criado na migration 20260629112200_enable_cron_net_job.sql
-- apontava para /functions/v1/process-email-queue (inexistente, gerando 404 a cada hora).
-- Esta migration desativa o job com segurança e de forma idempotente.
--
-- Rollback (Reversibilidade):
--   Caso deseje agendar a função correta (process-behavior-emails) futuramente, usar cron.schedule apontando para /functions/v1/process-behavior-emails com chave autenticada via vault.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue-cron'
    ) THEN
      PERFORM cron.unschedule('process-email-queue-cron');
    END IF;
  END IF;
END $$;
