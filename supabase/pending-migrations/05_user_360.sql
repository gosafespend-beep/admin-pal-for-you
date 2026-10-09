-- 05_user_360.sql
--
-- NOT applied automatically. Safe to apply BEFORE the matching edge functions
-- and frontend are deployed:
--   * admin_list_users keeps working for the currently deployed admin-users
--     function (the three new parameters have defaults);
--   * admin_user_360 is new and nothing calls it yet.
--
-- Adds, for the User 360 page and the Users list:
--   plan   paid | trial | granted | free
--   stage  signed_up | onboarded | activated | paying
--   platforms  which apps the person has used (android / ios)
-- computed in SQL from subscriptions, store entitlements and analytics events.

-- 1. Users list v2 -----------------------------------------------------------
drop function if exists public.admin_list_users(text, text, text, text, text, text, int, int);

create or replace function public.admin_list_users(
  p_search   text default '',
  p_role     text default '',
  p_verified text default '',
  p_status   text default '',
  p_sort     text default 'created_at',
  p_order    text default 'desc',
  p_limit    int  default 20,
  p_offset   int  default 0,
  p_platform text default '',
  p_plan     text default '',
  p_stage    text default ''
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $fn$
declare
  v_sort   text := case when p_sort in ('created_at','last_sign_in_at','email','display_name','updated_at') then p_sort else 'created_at' end;
  v_dir    text := case when lower(coalesce(p_order, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_pat    text := '%' || replace(replace(replace(lower(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  execute format($q$
    with ev as (
      select user_id,
             array_agg(distinct platform) filter (where platform is not null) as platforms,
             bool_or(event = 'onboarding_complete') as onboarded
      from public.analytics_events where user_id is not null group by user_id
    ), has_tx as (
      select user_id from public.expenses
      union select user_id from public.incomes
    ), rc as (
      select user_id,
             bool_or(is_active and coalesce(period_type, '') <> 'trial') as paid,
             bool_or(is_active and period_type = 'trial')               as trial
      from public.revenuecat_entitlements group by user_id
    ), base as (
      select u.id,
             u.email::text as email,
             u.email_confirmed_at, u.created_at, u.updated_at, u.last_sign_in_at, u.banned_until,
             p.display_name, p.avatar_url,
             coalesce(s.currency, 'USD')            as currency,
             coalesce(s.theme, 'dark')              as theme,
             coalesce(s.date_format, 'MM/dd/yyyy')  as date_format,
             coalesce(r.roles, array[]::text[])     as roles,
             'admin' = any(coalesce(r.roles, array[]::text[])) as is_admin,
             coalesce(ev.platforms, array[]::text[]) as platforms,
             case
               when (sub.status = 'active' and sub.paystack_subscription_code is not null) or coalesce(rc.paid, false) then 'paid'
               when (sub.status = 'trialing' and sub.trial_end > now()) or coalesce(rc.trial, false)                 then 'trial'
               when sub.status = 'active'                                                                           then 'granted'
               else 'free'
             end as plan,
             case
               when (sub.status = 'active' and sub.paystack_subscription_code is not null) or coalesce(rc.paid, false) then 'paying'
               when tx.user_id is not null           then 'activated'
               when coalesce(ev.onboarded, false)    then 'onboarded'
               else 'signed_up'
             end as stage
      from auth.users u
      left join public.profiles p       on p.user_id = u.id
      left join public.user_settings s  on s.user_id = u.id
      left join public.subscriptions sub on sub.user_id = u.id
      left join ev                      on ev.user_id = u.id
      left join rc                      on rc.user_id = u.id
      left join has_tx tx               on tx.user_id = u.id
      left join (select user_id, array_agg(role::text) as roles
                 from public.user_roles group by user_id) r on r.user_id = u.id
      where u.deleted_at is null
    ), filtered as (
      select * from base
      where ($1 = '%%%%'
             or lower(coalesce(email, '')) like $1 escape '\'
             or lower(coalesce(display_name, '')) like $1 escape '\')
        and ($2 = '' or ($2 = 'admin' and is_admin) or ($2 = 'user' and not is_admin))
        and ($3 = '' or ($3 = 'verified' and email_confirmed_at is not null)
                     or ($3 = 'unverified' and email_confirmed_at is null))
        and ($4 = '' or ($4 = 'suspended' and banned_until > now())
                     or ($4 = 'active' and (banned_until is null or banned_until <= now())))
        and ($7 = '' or $7 = any(platforms))
        and ($8 = '' or plan = $8)
        and ($9 = '' or stage = $9)
    ), page as (
      select f.*, row_number() over (order by %I %s nulls last, f.id) as rn
      from filtered f
      order by rn
      limit $5 offset $6
    )
    select jsonb_build_object(
      'users', coalesce((select jsonb_agg(to_jsonb(page) - 'rn' order by rn) from page), '[]'::jsonb),
      'total', (select count(*) from filtered),
      'stats', jsonb_build_object(
        'totalUsers',     (select count(*) from base),
        'totalAdmins',    (select count(*) from base where is_admin),
        'totalVerified',  (select count(*) from base where email_confirmed_at is not null),
        'totalSuspended', (select count(*) from base where banned_until > now()),
        'paying',         (select count(*) from base where plan = 'paid'),
        'trialing',       (select count(*) from base where plan = 'trial')
      )
    )
  $q$, v_sort, v_dir)
  into v_result
  using v_pat, coalesce(p_role, ''), coalesce(p_verified, ''), coalesce(p_status, ''), v_limit, v_offset,
        coalesce(p_platform, ''), coalesce(p_plan, ''), coalesce(p_stage, '');

  return v_result;
end
$fn$;

revoke all on function public.admin_list_users(text, text, text, text, text, text, int, int, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, text, text, text, text, int, int, text, text, text) to service_role;

-- 2. User 360 overview ---------------------------------------------------------
-- Everything about one person that is safe to show by default: counts and
-- timestamps, never amounts, notes or account names. Individual transactions
-- are only available through the reasoned, audited "reveal" action.
create or replace function public.admin_user_360(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select jsonb_build_object(
    'acquisition', (
      select jsonb_build_object(
               'source', p.acquisition_source, 'medium', p.acquisition_medium,
               'campaign', p.acquisition_campaign, 'content', p.acquisition_content,
               'referrer', p.acquisition_referrer, 'landingPath', p.acquisition_landing_path,
               'country', p.acquisition_country, 'acquiredAt', p.acquired_at,
               'writeAccessUntil', p.write_access_until)
      from public.profiles p where p.user_id = p_user_id),
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('platform', platform, 'events', n, 'firstSeen', f, 'lastSeen', l) order by l desc)
      from (select platform, count(*) as n, min(created_at) as f, max(created_at) as l
            from public.analytics_events where user_id = p_user_id and platform is not null
            group by platform) t), '[]'::jsonb),
    'milestones', (
      select jsonb_build_object(
               'signup',            min(created_at) filter (where event = 'signup'),
               'onboardingComplete',min(created_at) filter (where event = 'onboarding_complete'),
               'firstTransaction',  min(created_at) filter (where event = 'first_transaction'),
               'paywallView',       min(created_at) filter (where event = 'paywall_view'),
               'checkoutStart',     min(created_at) filter (where event = 'checkout_start'),
               'purchaseSuccess',   min(created_at) filter (where event = 'purchase_success'),
               'lastEvent',         max(created_at),
               'events',            count(*))
      from public.analytics_events where user_id = p_user_id),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('event', event, 'platform', platform, 'at', created_at) order by created_at desc)
      from (select event, platform, created_at from public.analytics_events
            where user_id = p_user_id order by created_at desc limit 40) t), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'currency', currency, 'active', is_active) order by created_at)
      from public.accounts where user_id = p_user_id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'expenses',  (select count(*) from public.expenses where user_id = p_user_id),
      'incomes',   (select count(*) from public.incomes where user_id = p_user_id),
      'transfers', (select count(*) from public.transfers where user_id = p_user_id),
      'accounts',  (select count(*) from public.accounts where user_id = p_user_id),
      'budgets',   (select count(*) from public.budgets where user_id = p_user_id),
      'goals',     (select count(*) from public.savings_goals where user_id = p_user_id),
      'bills',     (select count(*) from public.bills where user_id = p_user_id),
      'debts',     (select count(*) from public.debts where user_id = p_user_id),
      'recurring', (select count(*) from public.recurring_transactions where user_id = p_user_id)),
    'lastTransactionAt', (select max(t) from (
      select max(created_at) as t from public.expenses where user_id = p_user_id
      union all select max(created_at) from public.incomes where user_id = p_user_id) x),
    'entitlements', coalesce((
      select jsonb_agg(to_jsonb(r) - 'user_id' - 'event_timestamp_ms' - 'event_id')
      from public.revenuecat_entitlements r where r.user_id = p_user_id), '[]'::jsonb),
    'notifications', (
      select jsonb_build_object('billReminders', n.bill_reminders, 'budgetAlerts', n.budget_alerts,
                                'marketingEmails', n.marketing_emails, 'weeklySummary', n.weekly_summary)
      from public.notification_preferences n where n.user_id = p_user_id)
  )
$fn$;

revoke all on function public.admin_user_360(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_360(uuid) to service_role;

-- Rollback:
--   drop function public.admin_user_360(uuid);
--   drop function public.admin_list_users(text, text, text, text, text, text, int, int, text, text, text);
--   then recreate the 8-parameter admin_list_users from 03_server_side_admin_queries.sql
