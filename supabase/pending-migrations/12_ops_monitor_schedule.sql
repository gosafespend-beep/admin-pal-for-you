-- 12_ops_monitor_schedule.sql
--
-- NOT applied automatically. Apply this LAST, after migration 11 and after the
-- ops-monitor edge function is deployed: it starts the monitor running every
-- 30 minutes, and the first run emails about whatever is already wrong.
--
-- Same pattern as the billing monitor (entitlement-monitor-daily): the shared
-- secret is read from Vault when the job fires and never appears in a command,
-- a log or a deploy.
--
-- Idempotent: running it again replaces the job instead of adding a second one.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ops-monitor') then
    perform cron.unschedule('ops-monitor');
  end if;

  perform cron.schedule(
    'ops-monitor',
    '*/30 * * * *',
    $cron$
      select net.http_post(
        url     := 'https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/ops-monitor',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'monitor_cron_secret')
                   ),
        body    := '{"source":"pg_cron"}'::jsonb
      );
    $cron$
  );
end
$$;

-- Rollback:
--   select cron.unschedule('ops-monitor');
