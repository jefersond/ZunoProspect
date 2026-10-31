-- Migration: Desativação segura de cron job legado com endpoint obsoleto
-- IMPORTANTE: Preparada para lançamento (NÃO APLICADA em produção até autorização explícita)
--
-- O job 'process-email-queue-cron' criado na migration 20260629112200_enable_cron_net_job.sql
-- apontava para /functions/v1/process-email-queue (inexistente, gerando 404 a cada hora).
-- Esta migration desativa o job com segurança e de forma idempotente.

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
