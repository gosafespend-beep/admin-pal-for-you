-- 14_marketing_fixes.sql
--
-- Fixes two problems the monitor found in the marketing system:
--
--  1. Nothing renewed the Instagram and Threads logins. Both are valid for 60
--     days and were last renewed by hand on 2026-08-12, so they were about to
--     expire. This schedules the renewal functions that already existed
--     (ig-token-refresh, threads-token-refresh) every Monday. A renewal needs a
--     token that is at least a day old and not yet expired, so weekly is safe
--     and leaves eight chances before a 60-day token lapses.
--  2. The weekly report's sender address was still the template placeholder
--     (reports@REPLACE_WITH_YOUR_DOMAIN), so report and watchdog emails could
--     not send. It is set to the address the platform already sends monitoring
--     mail from. Only changed while it is still the placeholder.
--
-- Idempotent: running it again replaces the jobs and leaves a real sender alone.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sgs-ig-token-refresh') then
    perform cron.unschedule('sgs-ig-token-refresh');
  end if;
  if exists (select 1 from cron.job where jobname = 'sgs-threads-token-refresh') then
    perform cron.unschedule('sgs-threads-token-refresh');
  end if;
  perform cron.schedule('sgs-ig-token-refresh', '30 3 * * 1', $cron$select sgs.fire('ig-token-refresh', '{}'::jsonb);$cron$);
  perform cron.schedule('sgs-threads-token-refresh', '40 3 * * 1', $cron$select sgs.fire('threads-token-refresh', '{}'::jsonb);$cron$);
end
$$;

update public.sgs_config
   set value = 'Go Safe Spend Growth <info@gosafespend.com>', updated_at = now()
 where key = 'report_from' and value ilike '%REPLACE_WITH%';

-- Rollback:
--   select cron.unschedule('sgs-ig-token-refresh');
--   select cron.unschedule('sgs-threads-token-refresh');
