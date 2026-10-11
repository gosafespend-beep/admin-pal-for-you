-- 17_lifecycle_schedule.sql
--
-- NOT applied automatically. Apply AFTER migration 16 and AFTER the
-- lifecycle-send function is deployed.
--
-- Runs the lifecycle sender every hour (at 10 past). Safe to schedule straight
-- away: it does nothing while Sending is Off, which is how migration 16 leaves
-- it, and in Dry run it only counts. The secret is read from Vault when the job
-- fires, the same way as the ops monitor, and never appears in a command or log.
-- Idempotent: running it again replaces the job.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'lifecycle-send') then
    perform cron.unschedule('lifecycle-send');
  end if;

  perform cron.schedule(
    'lifecycle-send',
    '10 * * * *',
    $cron$
      select net.http_post(
        url     := 'https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/lifecycle-send',
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
--   select cron.unschedule('lifecycle-send');
