-- Habilita as extensões pg_cron (em pg_catalog) e pg_net de forma resiliente
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Aviso ao habilitar pg_cron: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Aviso ao habilitar pg_net: %', SQLERRM;
  END;
END $$;

-- Remove o job antigo se ele já existir na tabela de agendamentos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND to_regclass('cron.job') IS NOT NULL
  THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue-cron') THEN
      PERFORM cron.unschedule('process-email-queue-cron');
    END IF;
  END IF;
END $$;

-- NOTA DE SEGURANÇA (RC-1): O agendamento legado para /functions/v1/process-email-queue
-- com URL de produção hardcoded foi desativado para impedir disparos externos acidentais
-- em ambientes locais/staging e consolidado na migration 20261031130000_disable_legacy_cron_process_emails.sql.
