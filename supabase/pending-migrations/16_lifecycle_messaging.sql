-- 16_lifecycle_messaging.sql
--
-- NOT applied automatically. Additive. Applying it sends nothing: the system
-- ships with sending OFF and every template switched off.
--
-- Lifecycle emails to customers: a welcome, a "log your first transaction"
-- nudge, and a trial-ending reminder. Built so it cannot surprise anyone:
--
--  * Sending has three modes: off (default), dry run (works out who would get
--    what and sends nothing), and live.
--  * A template reaches only people whose trigger happens AFTER it was switched
--    on (live_since). Switching one on never mails the existing user base.
--  * A trigger older than 7 days is dropped rather than sent late.
--  * Each person gets each template at most once, and at most one lifecycle
--    email per min_gap_hours; the whole system obeys a daily cap.
--  * Two kinds of email. "service" emails are about the person's own account
--    (welcome, trial ending) and go to every confirmed account. "marketing"
--    emails (the nudge) go only to people with notification_preferences
--    .marketing_emails = true, which is the app's own opt-in (default false).
--    Today that is one account; the rest have never opted in.
--  * Marketing emails carry a one-click unsubscribe that turns
--    marketing_emails off.
--
-- lifecycle_sends and lifecycle_unsub_tokens carry user_id, so
-- delete_user_data removes them with the account (and the data export lists them).
-- All functions are service role only.

-- 1. Settings (one row) -----------------------------------------------------------------
create table if not exists public.lifecycle_settings (
  id             integer primary key default 1 check (id = 1),
  mode           text not null default 'off' check (mode in ('off', 'dry_run', 'live')),
  daily_cap      integer not null default 25 check (daily_cap between 1 and 500),
  min_gap_hours  integer not null default 72 check (min_gap_hours between 1 and 720),
  app_url        text not null default 'https://app.gosafespend.com' check (app_url ~ '^https://'),
  updated_by     uuid,
  updated_at     timestamptz not null default now()
);
insert into public.lifecycle_settings (id) values (1) on conflict (id) do nothing;

-- 2. Templates ----------------------------------------------------------------------------
create table if not exists public.lifecycle_templates (
  key          text primary key check (key in ('welcome', 'activation_nudge', 'trial_ending')),
  subject      text not null check (length(subject) between 3 and 150),
  body         text not null check (length(body) between 20 and 3000),
  audience     text not null default 'service' check (audience in ('service', 'marketing')),
  enabled      boolean not null default false,
  live_since   timestamptz,
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  -- Only the nudge may be either kind; the other two are always about the person's own account.
  constraint lifecycle_audience_ck check (key = 'activation_nudge' or audience = 'service')
);

insert into public.lifecycle_templates (key, subject, body, audience) values
  ('welcome', 'Welcome to Safe Spend',
   E'Hi {{first_name}},\n\nWelcome to Safe Spend. The quickest way to see it work is to add one expense or income, even a small one.\n\nOpen the app: {{app_url}}\n\nIf you have any questions, just reply to this email.\n\nThe Safe Spend team',
   'service'),
  ('activation_nudge', 'A quick tip to get started with Safe Spend',
   E'Hi {{first_name}},\n\nYou created your Safe Spend account a few days ago but have not added a transaction yet. It takes about 20 seconds: add an expense or an income and your budgets and reports start to fill in.\n\nPick up where you left off: {{app_url}}\n\nNeed a hand? Just reply to this email.\n\nThe Safe Spend team',
   'marketing'),
  ('trial_ending', 'Your Safe Spend trial ends on {{trial_end}}',
   E'Hi {{first_name}},\n\nYour free trial ends on {{trial_end}}. Your data stays safe, and subscribing keeps everything working as before.\n\nManage your plan: {{app_url}}\n\nQuestions about plans or pricing? Just reply to this email.\n\nThe Safe Spend team',
   'service')
on conflict (key) do nothing;

-- 3. What was sent -----------------------------------------------------------------------
create table if not exists public.lifecycle_sends (
  id           bigserial primary key,
  user_id      uuid not null,
  template_key text not null,
  status       text not null check (status in ('sent', 'failed')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now()
);
create unique index if not exists lifecycle_sends_once_uidx on public.lifecycle_sends (user_id, template_key) where status = 'sent';
create index if not exists lifecycle_sends_created_idx on public.lifecycle_sends (created_at desc);
create index if not exists lifecycle_sends_user_idx on public.lifecycle_sends (user_id);

-- 4. One-click unsubscribe tokens --------------------------------------------------------
create table if not exists public.lifecycle_unsub_tokens (
  user_id    uuid primary key,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.lifecycle_settings enable row level security;
alter table public.lifecycle_templates enable row level security;
alter table public.lifecycle_sends enable row level security;
alter table public.lifecycle_unsub_tokens enable row level security;
revoke all on public.lifecycle_settings, public.lifecycle_templates, public.lifecycle_sends, public.lifecycle_unsub_tokens from anon, authenticated;
grant select, insert, update on public.lifecycle_settings, public.lifecycle_templates, public.lifecycle_sends, public.lifecycle_unsub_tokens to service_role;
grant usage, select on sequence public.lifecycle_sends_id_seq to service_role;

-- 5. Who should get this template right now ------------------------------------------------
create or replace function public.admin_lifecycle_candidates(p_key text, p_limit integer default 50)
returns table (user_id uuid, email text, first_name text, trial_end timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $fn$
#variable_conflict use_column
declare
  v_tpl public.lifecycle_templates;
  v_gap interval;
begin
  select * into v_tpl from public.lifecycle_templates where key = p_key;
  if not found or v_tpl.live_since is null then return; end if;
  select make_interval(hours => min_gap_hours) into v_gap from public.lifecycle_settings where id = 1;

  return query
  with base as (
    select u.id as uid, u.email::text as mail,
           coalesce(nullif(trim(p.first_name), ''), nullif(split_part(trim(coalesce(p.display_name, '')), ' ', 1), '')) as fname,
           u.created_at as signed_up, s.status as sub_status, s.trial_end as sub_trial_end
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join lateral (select status, trial_end from public.subscriptions where user_id = u.id order by created_at desc limit 1) s on true
    left join public.notification_preferences np on np.user_id = u.id
    where u.deleted_at is null and u.email is not null and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and case
            when v_tpl.audience = 'marketing' then coalesce(np.marketing_emails, false)
            when p_key = 'activation_nudge'   then coalesce(np.marketing_emails, true)
            else true end
  ), trig as (
    select b.*,
           case p_key
             when 'welcome'          then b.signed_up + interval '15 minutes'
             when 'activation_nudge' then b.signed_up + interval '3 days'
             when 'trial_ending'     then b.sub_trial_end - interval '2 days'
           end as trigger_at
    from base b
    where case p_key
            when 'welcome' then true
            when 'activation_nudge' then
              not exists (select 1 from public.expenses e where e.user_id = b.uid)
              and not exists (select 1 from public.incomes i where i.user_id = b.uid)
            when 'trial_ending' then
              b.sub_status = 'trialing' and b.sub_trial_end > now()
              and not exists (select 1 from public.revenuecat_entitlements r
                              where r.user_id = b.uid and r.is_active and coalesce(r.period_type, '') <> 'trial')
            else false end
  )
  select t.uid, t.mail, t.fname, t.sub_trial_end
  from trig t
  where t.trigger_at is not null
    and t.trigger_at <= now()
    and t.trigger_at >= greatest(v_tpl.live_since, now() - interval '7 days')
    and not exists (select 1 from public.lifecycle_sends ls where ls.user_id = t.uid and ls.template_key = p_key and ls.status = 'sent')
    and (select count(*) from public.lifecycle_sends ls where ls.user_id = t.uid and ls.template_key = p_key and ls.status = 'failed') < 3
    and not exists (select 1 from public.lifecycle_sends ls where ls.user_id = t.uid and ls.status = 'sent' and ls.created_at > now() - v_gap)
  order by t.trigger_at
  limit least(greatest(p_limit, 0), 1000);
end
$fn$;

-- 6. The page's numbers --------------------------------------------------------------------
create or replace function public.admin_lifecycle_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from public.lifecycle_settings s where id = 1),
    'sentToday', (select count(*) from public.lifecycle_sends where status = 'sent' and created_at >= date_trunc('day', now())),
    'templates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', t.key, 'subject', t.subject, 'body', t.body, 'audience', t.audience, 'enabled', t.enabled,
        'liveSince', t.live_since, 'updatedAt', t.updated_at,
        'eligibleNow', (select count(*) from public.admin_lifecycle_candidates(t.key, 1000)),
        'sent7d',  (select count(*) from public.lifecycle_sends ls where ls.template_key = t.key and ls.status = 'sent'   and ls.created_at > now() - interval '7 days'),
        'sentTotal', (select count(*) from public.lifecycle_sends ls where ls.template_key = t.key and ls.status = 'sent'),
        'failed7d', (select count(*) from public.lifecycle_sends ls where ls.template_key = t.key and ls.status = 'failed' and ls.created_at > now() - interval '7 days'))
        order by case t.key when 'welcome' then 1 when 'activation_nudge' then 2 else 3 end)
      from public.lifecycle_templates t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('userId', user_id, 'template', template_key, 'status', status, 'error', left(coalesce(error, ''), 160), 'at', created_at) order by created_at desc)
      from (select * from public.lifecycle_sends order by created_at desc limit 20) r), '[]'::jsonb)
  ) into v;
  return v;
end
$fn$;

-- 7. Unsubscribe ---------------------------------------------------------------------------
create or replace function public.lifecycle_unsub_token(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v uuid;
begin
  insert into public.lifecycle_unsub_tokens (user_id) values (p_user) on conflict (user_id) do nothing;
  select token into v from public.lifecycle_unsub_tokens where user_id = p_user;
  return v;
end
$fn$;

create or replace function public.lifecycle_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid;
begin
  select user_id into v_uid from public.lifecycle_unsub_tokens where token = p_token;
  if not found then return false; end if;
  insert into public.notification_preferences (user_id, marketing_emails) values (v_uid, false)
    on conflict (user_id) do update set marketing_emails = false, updated_at = now();
  return true;
end
$fn$;

-- 8. Let the monitor see whether lifecycle emails are failing ----------------------------------
-- Same function as migration 11 with one more key. A failed send is recorded by lifecycle-send, so
-- this is the only way a broken email provider or key shows up before someone notices no email arrived.
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
      'oldestOverdue', (select min(due_at) from public.data_requests where status in ('received', 'in_progress') and due_at < now())),
    'lifecycle', jsonb_build_object(
      'mode',      (select mode from public.lifecycle_settings where id = 1),
      'failed24h', (select count(*) from public.lifecycle_sends where status = 'failed' and created_at > now() - interval '24 hours'))
  )
$fn$;

revoke all on function public.admin_lifecycle_candidates(text, integer) from public, anon, authenticated;
revoke all on function public.admin_lifecycle_overview() from public, anon, authenticated;
revoke all on function public.lifecycle_unsub_token(uuid) from public, anon, authenticated;
revoke all on function public.lifecycle_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.admin_lifecycle_candidates(text, integer) to service_role;
grant execute on function public.admin_lifecycle_overview() to service_role;
grant execute on function public.lifecycle_unsub_token(uuid) to service_role;
grant execute on function public.lifecycle_unsubscribe(uuid) to service_role;

-- Rollback:
--   drop function public.lifecycle_unsubscribe(uuid); drop function public.lifecycle_unsub_token(uuid);
--   drop function public.admin_lifecycle_overview(); drop function public.admin_lifecycle_candidates(text, integer);
--   drop table public.lifecycle_unsub_tokens, public.lifecycle_sends, public.lifecycle_templates, public.lifecycle_settings;
