-- 07_growth_metrics.sql
--
-- NOT applied automatically. Additive; safe to apply before the matching edge
-- function and frontend are deployed (nothing calls it yet).
--
-- One definition of each growth metric, counted in unique PEOPLE (not events),
-- over a window of signup weeks:
--
--   signed up   a row in auth.users created in the window
--   set up      has at least one account (onboarding creates it)
--   tracked     has at least one app analytics event under their user id
--   onboarded   has an onboarding_complete event
--   activated   has at least one expense or income. This comes from the data
--               itself, not from events, because most accounts have no events
--               (older app builds, or events sent before sign-in)
--   saw paywall has a paywall_view event
--   checkout    has a checkout_start event
--   paid        pays through Paystack or a production store purchase
--
-- Retention "dN" = was active (an event, expense or income) at least N days
-- after signing up, counted only among people who signed up at least N days ago.
-- Coverage is returned alongside so thin data is visible, not hidden.

create or replace function public.admin_growth_metrics(p_weeks int default 12)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  with
  cfg as (select least(greatest(coalesce(p_weeks, 12), 1), 52) as w),
  u as (
    select id, created_at, date_trunc('week', created_at)::date as wk
    from auth.users
    where deleted_at is null
      and created_at >= date_trunc('week', now()) - ((select w from cfg) - 1) * interval '1 week'
  ),
  ev as (
    select user_id,
           count(*) as n,
           array_agg(distinct platform) filter (where platform is not null) as platforms,
           bool_or(event = 'onboarding_complete') as onboarded,
           bool_or(event = 'paywall_view')        as paywall,
           bool_or(event = 'checkout_start')      as checkout
    from public.analytics_events where user_id is not null group by user_id
  ),
  tx as (
    select user_id, min(created_at) as first_tx
    from (select user_id, created_at from public.expenses
          union all select user_id, created_at from public.incomes) t
    group by user_id
  ),
  act as (
    select user_id, created_at from public.analytics_events where user_id is not null
    union all select user_id, created_at from public.expenses
    union all select user_id, created_at from public.incomes
  ),
  acc as (select distinct user_id from public.accounts),
  paid as (
    select user_id from public.subscriptions where status = 'active' and paystack_subscription_code is not null
    union
    select user_id from public.revenuecat_entitlements
      where is_active and environment = 'PRODUCTION' and coalesce(period_type, '') <> 'trial'
  ),
  m as (
    select u.id, u.wk, u.created_at,
           (acc.user_id is not null)                as set_up,
           (ev.user_id is not null)                 as tracked,
           coalesce(ev.onboarded, false)            as onboarded,
           (tx.user_id is not null)                 as activated,
           coalesce(ev.paywall, false)              as paywall,
           coalesce(ev.checkout, false)             as checkout,
           (paid.user_id is not null)               as paid,
           coalesce(ev.platforms, array[]::text[])  as platforms,
           tx.first_tx,
           pr.acquisition_source as source
    from u
    left join ev   on ev.user_id = u.id
    left join tx   on tx.user_id = u.id
    left join acc  on acc.user_id = u.id
    left join paid on paid.user_id = u.id
    left join public.profiles pr on pr.user_id = u.id
  ),
  ret as (
    select m.id,
           m.created_at,
           exists (select 1 from act a where a.user_id = m.id and a.created_at >= m.created_at + interval '1 day')  as r1,
           exists (select 1 from act a where a.user_id = m.id and a.created_at >= m.created_at + interval '7 day')  as r7,
           exists (select 1 from act a where a.user_id = m.id and a.created_at >= m.created_at + interval '30 day') as r30
    from m
  ),
  weeks as (
    select g::date as wk
    from generate_series(date_trunc('week', now()) - ((select w from cfg) - 1) * interval '1 week',
                         date_trunc('week', now()), interval '1 week') g
  )
  select jsonb_build_object(
    'weeks', (select w from cfg),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week', x.wk, 'signups', x.signups, 'setUp', x.set_up, 'tracked', x.tracked, 'onboarded', x.onboarded,
               'activated', x.activated, 'paywall', x.paywall, 'paid', x.paid) order by x.wk)
      from (select w.wk,
                   count(m.id)                              as signups,
                   count(m.id) filter (where m.set_up)      as set_up,
                   count(m.id) filter (where m.tracked)     as tracked,
                   count(m.id) filter (where m.onboarded)   as onboarded,
                   count(m.id) filter (where m.activated)   as activated,
                   count(m.id) filter (where m.paywall)     as paywall,
                   count(m.id) filter (where m.paid)        as paid
            from weeks w left join m on m.wk = w.wk
            group by w.wk) x), '[]'::jsonb),
    'funnel', (select jsonb_build_object(
        'signedUp',   count(*),
        'setUp',      count(*) filter (where set_up),
        'tracked',    count(*) filter (where tracked),
        'onboarded',  count(*) filter (where onboarded),
        'activated',  count(*) filter (where activated),
        'sawPaywall', count(*) filter (where paywall),
        'checkout',   count(*) filter (where checkout),
        'paid',       count(*) filter (where paid)) from m),
    'byPlatform', coalesce((
      select jsonb_agg(jsonb_build_object(
               'platform', p, 'users', n, 'onboarded', o, 'activated', a, 'sawPaywall', pw, 'paid', pd) order by n desc)
      from (select p, count(*) n,
                   count(*) filter (where onboarded) o, count(*) filter (where activated) a,
                   count(*) filter (where paywall) pw, count(*) filter (where paid) pd
            from m, unnest(m.platforms) p group by p) x), '[]'::jsonb),
    'retention', jsonb_build_object(
      'd1',  jsonb_build_object('eligible', count(*) filter (where created_at <= now() - interval '1 day')  , 'retained', count(*) filter (where r1  and created_at <= now() - interval '1 day')),
      'd7',  jsonb_build_object('eligible', count(*) filter (where created_at <= now() - interval '7 day')  , 'retained', count(*) filter (where r7  and created_at <= now() - interval '7 day')),
      'd30', jsonb_build_object('eligible', count(*) filter (where created_at <= now() - interval '30 day') , 'retained', count(*) filter (where r30 and created_at <= now() - interval '30 day'))),
    'acquisition', coalesce((
      select jsonb_agg(jsonb_build_object('source', s, 'users', n, 'activated', a, 'paid', pd) order by n desc)
      from (select coalesce(source, '(not recorded)') as s, count(*) n,
                   count(*) filter (where activated) a, count(*) filter (where paid) pd
            from m group by 1) x), '[]'::jsonb),
    'coverage', jsonb_build_object(
      'users',           (select count(*) from m),
      'withAcquisition', (select count(*) from m where source is not null),
      'tracked',         (select count(*) from m where tracked),
      'firstEvent',      (select min(created_at) from public.analytics_events)),
    'medianHoursToFirstTransaction', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (first_tx - created_at)) / 3600))::numeric, 1)
      from m where first_tx is not null and first_tx >= created_at)
  )
  from ret
$fn$;

revoke all on function public.admin_growth_metrics(int) from public, anon, authenticated;
grant execute on function public.admin_growth_metrics(int) to service_role;

-- Rollback:
--   drop function public.admin_growth_metrics(int);
