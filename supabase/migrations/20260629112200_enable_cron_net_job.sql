-- Habilita as extensões pg_cron e pg_net no schema extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove o job antigo se ele já existir na tabela de agendamentos
select cron.unschedule('process-email-queue-cron')
from cron.job
where jobname = 'process-email-queue-cron';

-- Cria o novo job para chamar a Edge Function a cada hora
select cron.schedule(
  'process-email-queue-cron',
  '0 * * * *', -- A cada hora
  $$
  select net.http_post(
    url := 'https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/process-email-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_YeaT-MiFQI5an3arlLZKDA_5x82IYBG"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
