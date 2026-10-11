-- 18_control_plane.sql
--
-- NOT applied automatically. Additive. Applying it changes nothing for anyone:
-- the banner is off, no minimum versions are set, and there are no flags. The
-- apps do not read any of this yet; they will once a release adds the call to
-- the app-config function.
--
-- The product control plane: a message or maintenance screen shown in the apps,
-- the newest and oldest-allowed app version per store, and feature flags with
-- gradual rollout. Edited from the admin panel, read by the apps through the
-- public app-config function (which returns only values meant to be public).
--
-- app_control and app_flags are service role only (no policies); the public
-- function reads them with the service key and filters what it returns.
-- Neither has a user_id column, so delete_user_data never touches them.

create table if not exists public.app_control (
  id                 integer primary key default 1 check (id = 1),
  banner_active      boolean not null default false,
  banner_kind        text not null default 'banner' check (banner_kind in ('banner', 'maintenance')),
  banner_severity    text not null default 'info' check (banner_severity in ('info', 'warning', 'critical')),
  banner_message     text not null default '' check (length(banner_message) <= 280),
  banner_starts_at   timestamptz,
  banner_ends_at     timestamptz,
  ios_latest         text check (ios_latest ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$'),
  ios_min            text check (ios_min ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$'),
  ios_store_url      text check (ios_store_url ~ '^https://'),
  android_latest     text check (android_latest ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$'),
  android_min        text check (android_min ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$'),
  android_store_url  text check (android_store_url ~ '^https://'),
  updated_by         uuid,
  updated_at         timestamptz not null default now(),
  constraint app_control_banner_text_ck check (not banner_active or length(trim(banner_message)) >= 5),
  constraint app_control_window_ck check (banner_starts_at is null or banner_ends_at is null or banner_ends_at > banner_starts_at),
  -- A minimum needs a newest version beside it (the admin function also checks min <= latest).
  constraint app_control_ios_ck check (ios_min is null or ios_latest is not null),
  constraint app_control_android_ck check (android_min is null or android_latest is not null)
);
insert into public.app_control (id) values (1) on conflict (id) do nothing;

create table if not exists public.app_flags (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  description  text not null check (length(description) between 3 and 200),
  enabled      boolean not null default false,
  rollout_pct  integer not null default 100 check (rollout_pct between 0 and 100),
  platforms    text[] not null default array['ios', 'android', 'web'] check (cardinality(platforms) > 0 and platforms <@ array['ios', 'android', 'web']),
  public       boolean not null default true,
  updated_by   uuid,
  updated_at   timestamptz not null default now()
);

alter table public.app_control enable row level security;
alter table public.app_flags enable row level security;
revoke all on public.app_control, public.app_flags from anon, authenticated;
grant select, insert, update, delete on public.app_control, public.app_flags to service_role;

-- Which app versions people are really using (last N days), from the version the apps put on their
-- events. Empty until an app release starts sending `app_version`; the page says so instead of guessing.
create or replace function public.admin_app_versions(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'version', version, 'users', users, 'events', events) order by platform, users desc), '[]'::jsonb)
  from (
    select coalesce(platform, 'unknown') as platform, props ->> 'app_version' as version,
           count(distinct user_id) as users, count(*) as events
    from public.analytics_events
    where created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
      and props ->> 'app_version' ~ '^\d{1,3}(\.\d{1,3}){0,2}$'
    group by 1, 2
  ) t
$fn$;

revoke all on function public.admin_app_versions(integer) from public, anon, authenticated;
grant execute on function public.admin_app_versions(integer) to service_role;

-- Rollback:
--   drop function public.admin_app_versions(integer);
--   drop table public.app_flags, public.app_control;
