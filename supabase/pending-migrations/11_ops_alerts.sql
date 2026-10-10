-- 11_ops_alerts.sql
--
-- NOT applied automatically. Additive; safe to apply before the matching edge
-- functions and frontend are deployed (nothing uses it yet).
--
-- Alerting. The monitor (edge function ops-monitor) looks for problems every
-- 30 minutes and records them here, so it can email only about what is new,
-- remind about what is still open, and say when something is fixed.
--
--  * ops_alerts: one row per problem ("fingerprint"), kept after it is fixed
--    so there is a history. No user_id column, so delete_user_data never
--    touches it. Service role only.
--  * admin_ops_signals(): the non-marketing facts the monitor checks: who has
--    admin access and since when, and how many data requests are late or due
--    soon. Counts and ids only.

create table if not exists public.ops_alerts (
  fingerprint         text primary key check (length(fingerprint) between 3 and 120),
  source              text not null check (length(source) between 2 and 40),
  severity            text not null check (severity in ('problem', 'warning')),
  title               text not null,
  detail              text not null default '',
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  seen_count          integer not null default 1,
  last_notified_at    timestamptz,
  notify_count        integer not null default 0,
  acknowledged_until  timestamptz,
  acknowledged_by     uuid,
  acknowledged_reason text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists ops_alerts_active_idx on public.ops_alerts (severity, first_seen_at) where resolved_at is null;
create index if not exists ops_alerts_resolved_idx on public.ops_alerts (resolved_at desc) where resolved_at is not null;

alter table public.ops_alerts enable row level security;
revoke all on public.ops_alerts from anon, authenticated;
grant select, insert, update on public.ops_alerts to service_role;

create or replace function public.admin_ops_signals()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select jsonb_build_object(
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object('userId', r.user_id, 'email', u.email, 'grantedAt', r.created_at) order by r.created_at desc)
      from public.user_roles r
      join auth.users u on u.id = r.user_id
      where r.role::text = 'admin' and u.deleted_at is null), '[]'::jsonb),
    'dataRequests', jsonb_build_object(
      'overdue',       (select count(*) from public.data_requests where status in ('received', 'in_progress') and due_at < now()),
      'dueSoon',       (select count(*) from public.data_requests where status in ('received', 'in_progress') and due_at >= now() and due_at < now() + interval '7 days'),
      'oldestOverdue', (select min(due_at) from public.data_requests where status in ('received', 'in_progress') and due_at < now())))
$fn$;

revoke all on function public.admin_ops_signals() from public, anon, authenticated;
grant execute on function public.admin_ops_signals() to service_role;

-- Rollback:
--   drop function public.admin_ops_signals();
--   drop table public.ops_alerts;
