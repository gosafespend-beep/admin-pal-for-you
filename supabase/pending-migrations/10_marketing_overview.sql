-- 10_marketing_overview.sql
--
-- NOT applied automatically. Additive and read-only; safe to apply before the
-- matching edge function and frontend are deployed (nothing calls it yet).
--
-- One function, admin_marketing_overview(), that reports on the automated
-- marketing system (the sgs_* tables and the scheduled jobs that drive them):
--   * publishing: when each channel last posted
--   * runs: how many agent runs succeeded or failed, and what keeps failing
--   * queue: how many posts are in each status
--   * spend: AI cost per day and per agent against each agent's daily cap
--   * channels: connection health and when each login token expires
--   * jobs: each scheduled job and its last run
--   * flags: the on/off settings that control publishing
--   * topPosts: the best performing recent posts
--
-- Privacy and safety
--  * Token columns (access_token, refresh_token, token_secret) are never read.
--    Only each token's expiry date is reported.
--  * Settings whose key looks like a secret are left out.
--  * Error text is cut to 200 characters.
--  * Granted to the service role only; the edge function checks is_admin().
--
-- A scheduled job shows "succeeded" when the call was sent, not when the work
-- worked, so job status alone hid a two-week failure. The real signal is the
-- agent run log, which is why 'runs' is read from sgs_action_log.

create or replace function public.admin_marketing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, cron
as $fn$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'generatedAt', now(),

    'publishing', jsonb_build_object(
      'lastPublishedAt', (select max(published_at) from public.sgs_publish_queue where status = 'published'),
      'byChannel', coalesce((
        select jsonb_agg(jsonb_build_object('channel', channel, 'last', last_at, 'published30d', n30) order by last_at desc nulls last)
        from (select channel, max(published_at) as last_at,
                     count(*) filter (where published_at > now() - interval '30 days') as n30
              from public.sgs_publish_queue where status = 'published' group by channel) t), '[]'::jsonb)),

    'runs', jsonb_build_object(
      'last24h', (select jsonb_build_object('ok', count(*) filter (where ok), 'failed', count(*) filter (where not ok))
                  from public.sgs_action_log where created_at > now() - interval '24 hours'),
      'last7d',  (select jsonb_build_object('ok', count(*) filter (where ok), 'failed', count(*) filter (where not ok))
                  from public.sgs_action_log where created_at > now() - interval '7 days'),
      'lastSuccessAt', (select max(created_at) from public.sgs_action_log where ok),
      'failing', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.failures desc)
        from (
          select f.agent_id as agent, f.action, count(*) as failures,
                 max(f.created_at) as "lastFailureAt",
                 (array_agg(left(regexp_replace(coalesce(f.error, ''), '\s+', ' ', 'g'), 200) order by f.created_at desc))[1] as "lastError",
                 (select max(s.created_at) from public.sgs_action_log s where s.agent_id = f.agent_id and s.action = f.action and s.ok) as "lastSuccessAt"
          from public.sgs_action_log f
          where not f.ok and f.created_at > now() - interval '7 days'
          group by f.agent_id, f.action
          order by count(*) desc
          limit 10) t), '[]'::jsonb)),

    'queue', jsonb_build_object(
      'byStatus', coalesce((
        select jsonb_agg(jsonb_build_object('status', status, 'count', n, 'oldest', oldest, 'newest', newest) order by n desc)
        from (select status, count(*) as n, min(created_at) as oldest, max(created_at) as newest
              from public.sgs_publish_queue group by status) t), '[]'::jsonb),
      'scheduledOverdue', (select count(*) from public.sgs_publish_queue
                           where status = 'scheduled' and scheduled_for < now() - interval '1 hour'),
      'reviewsPending', (select count(*) from public.sgs_review_queue where decision is null)),

    'incidents', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'agent', agent_id, 'kind', kind, 'severity', severity,
                                          'summary', left(coalesce(summary, ''), 200), 'createdAt', created_at) order by created_at desc)
      from (select * from public.sgs_incidents where closed_at is null order by created_at desc limit 20) i), '[]'::jsonb),

    'spend', jsonb_build_object(
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d, 'cost', round(cost::numeric, 4), 'runs', n, 'failed', f) order by d)
        from (select created_at::date as d, sum(coalesce(cost_usd, 0)) as cost, count(*) as n, count(*) filter (where not ok) as f
              from public.sgs_action_log where created_at > now() - interval '14 days' group by 1) t), '[]'::jsonb),
      'agents', coalesce((
        select jsonb_agg(to_jsonb(t) order by t."cost30d" desc nulls last)
        from (
          select a.id, a.codename, a.status, a.tier,
                 a.hard_cap_usd_day::float as "capUsdDay",
                 coalesce(l.runs, 0) as "runs30d", coalesce(l.failed, 0) as "failed30d",
                 round(coalesce(l.cost, 0)::numeric, 4)::float as "cost30d",
                 round(coalesce(l.cost_today, 0)::numeric, 4)::float as "costToday",
                 l.last_run as "lastRunAt"
          from public.sgs_agents_rt a
          left join (
            select agent_id, count(*) as runs, count(*) filter (where not ok) as failed, sum(coalesce(cost_usd, 0)) as cost,
                   sum(coalesce(cost_usd, 0)) filter (where created_at >= date_trunc('day', now())) as cost_today,
                   max(created_at) as last_run
            from public.sgs_action_log where created_at > now() - interval '30 days' group by agent_id) l on l.agent_id = a.id) t), '[]'::jsonb)),

    'channels', coalesce((
      select jsonb_agg(jsonb_build_object(
               'platform', c.platform, 'handle', c.handle, 'enabled', c.enabled,
               'healthOk', h.ok, 'healthDetail', left(coalesce(h.detail, ''), 200), 'checkedAt', h.checked_at,
               'tokenExpiresAt', case c.platform
                  when 'instagram' then (select expires_at from public.sgs_ig_token order by updated_at desc limit 1)
                  when 'threads'   then (select expires_at from public.sgs_threads_token order by updated_at desc limit 1)
                  when 'facebook'  then (select expires_at from public.sgs_fb_token order by updated_at desc limit 1)
                  when 'tumblr'    then (select expires_at from public.sgs_tumblr_token order by updated_at desc limit 1)
                  else null end,
               'tokenUpdatedAt', case c.platform
                  when 'instagram' then (select updated_at from public.sgs_ig_token order by updated_at desc limit 1)
                  when 'threads'   then (select updated_at from public.sgs_threads_token order by updated_at desc limit 1)
                  when 'facebook'  then (select updated_at from public.sgs_fb_token order by updated_at desc limit 1)
                  when 'tumblr'    then (select updated_at from public.sgs_tumblr_token order by updated_at desc limit 1)
                  else null end)
             order by c.enabled desc, c.platform)
      from public.sgs_channels c left join public.sgs_channel_health h on h.platform = c.platform), '[]'::jsonb),

    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
               'target', coalesce(substring(j.command from 'fire\(''([a-z0-9-]+)'''), substring(j.command from 'functions/v1/([a-z0-9-]+)'), 'database'),
               'lastRunAt', d.start_time, 'lastStatus', d.status) order by j.jobname)
      from cron.job j
      left join lateral (select start_time, status from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 1) d on true), '[]'::jsonb),

    'flags', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'value', left(value::text, 200), 'updatedAt', updated_at) order by key)
      from public.sgs_config where key !~* '(token|secret|key|password|credential)'), '[]'::jsonb),

    'topPosts', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (select channel, format, posted_at as "postedAt", views, reach, engagement_rate as "engagementRate", left(coalesce(caption, ''), 140) as caption
            from public.sgs_post_metrics
            where posted_at > now() - interval '30 days' and coalesce(views, 0) > 0
            order by engagement_rate desc nulls last, views desc limit 5) t), '[]'::jsonb)
  ) into v;
  return v;
end
$fn$;

revoke all on function public.admin_marketing_overview() from public, anon, authenticated;
grant execute on function public.admin_marketing_overview() to service_role;

-- Rollback:
--   drop function public.admin_marketing_overview();
