-- 13_health_signals.sql
--
-- NOT applied automatically. Additive and read-only; safe to apply before the
-- matching edge function and frontend are deployed (nothing calls it yet).
--
-- admin_health_signals(): the facts about the platform that live in the
-- database, for the System health page and the monitor:
--   * db: size and how many of the allowed connections are in use
--   * freshness: when each automatic process last produced something
--     (exchange rates, app events, sign-ups, store and Paystack billing updates)
--   * cron: scheduled jobs that FAILED in the last 24 hours
--   * http: how the calls fired by scheduled jobs were answered. The database
--     keeps these for only about 6 hours (pg_net), but they are the one place a
--     job that "succeeded" because its call was sent, and then got a 500 back,
--     shows up at all.
--
-- Response text is cut to 120 characters. Service role only.

create or replace function public.admin_health_signals()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, cron, net
as $fn$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'generatedAt', now(),

    'db', jsonb_build_object(
      'sizeBytes', pg_database_size(current_database()),
      'connections', (select count(*) from pg_stat_activity where datname = current_database()),
      'maxConnections', current_setting('max_connections')::int),

    'freshness', jsonb_build_object(
      'fxRatesAt',          (select max(fetched_at) from public.fx_rates),
      'lastEventAt',        (select max(created_at) from public.analytics_events),
      'lastSignupAt',       (select max(created_at) from auth.users),
      'lastStoreEventAt',   (select max(to_timestamp(event_timestamp_ms / 1000.0)) from public.revenuecat_entitlements),
      'lastPaystackUpdateAt', (select max(updated_at) from public.subscriptions where paystack_subscription_code is not null)),

    'cron', jsonb_build_object(
      'failed24h', coalesce((
        select jsonb_agg(jsonb_build_object('job', jobname, 'failures', n, 'last', last_at, 'message', msg) order by n desc)
        from (select j.jobname, count(*) as n, max(d.start_time) as last_at,
                     (array_agg(left(coalesce(d.return_message, ''), 120) order by d.start_time desc))[1] as msg
              from cron.job_run_details d join cron.job j on j.jobid = d.jobid
              where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'
              group by j.jobname) t), '[]'::jsonb)),

    'http', jsonb_build_object(
      'since', (select min(created) from net._http_response),
      'total', (select count(*) from net._http_response),
      'failures', coalesce((
        select jsonb_agg(jsonb_build_object('status', status, 'count', n, 'sample', sample) order by n desc)
        from (select coalesce(status_code::text, 'no response') as status, count(*) as n,
                     (array_agg(left(regexp_replace(coalesce(content, error_msg, ''), '\s+', ' ', 'g'), 120) order by created desc))[1] as sample
              from net._http_response
              where status_code is null or status_code >= 400
              group by 1) t), '[]'::jsonb))
  ) into v;
  return v;
end
$fn$;

revoke all on function public.admin_health_signals() from public, anon, authenticated;
grant execute on function public.admin_health_signals() to service_role;

-- Rollback:
--   drop function public.admin_health_signals();
