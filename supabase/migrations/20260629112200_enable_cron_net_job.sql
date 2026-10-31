-- Habilita as extensões pg_cron e pg_net no schema extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove o job antigo se ele já existir na tabela de agendamentos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue-cron') THEN
    PERFORM cron.unschedule('process-email-queue-cron');
  END IF;
END $$;

-- NOTA DE SEGURANÇA (RC-1): O agendamento legado para /functions/v1/process-email-queue
-- com URL de produção hardcoded foi desativado para impedir disparos externos acidentais
-- em ambientes locais/staging e consolidado na migration 20261031130000_disable_legacy_cron_process_emails.sql.
