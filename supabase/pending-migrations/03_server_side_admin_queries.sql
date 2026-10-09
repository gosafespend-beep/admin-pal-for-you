-- 03_server_side_admin_queries.sql
--
-- NOT applied automatically. Additive and safe to apply BEFORE the matching
-- edge functions are deployed (they call these; nothing calls them yet).
--
-- Replaces two patterns that stop scaling:
--   * admin-users: auth.admin.listUsers() + three table scans + in-memory
--     filter/sort/paginate on every request.
--   * admin-analytics: reading every expense/income row just to count users.
-- Both are now one SQL statement each, executed by the service role only.

-- 1. Users list: filter, sort, paginate and count in the database ------------
create or replace function public.admin_list_users(
  p_search   text default '',
  p_role     text default '',
  p_verified text default '',
  p_status   text default '',
  p_sort     text default 'created_at',
  p_order    text default 'desc',
  p_limit    int  default 20,
  p_offset   int  default 0
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
    with base as (
      select u.id,
             u.email::text as email,
             u.email_confirmed_at, u.created_at, u.updated_at, u.last_sign_in_at, u.banned_until,
             p.display_name, p.avatar_url,
             coalesce(s.currency, 'USD')            as currency,
             coalesce(s.theme, 'dark')              as theme,
             coalesce(s.date_format, 'MM/dd/yyyy')  as date_format,
             coalesce(r.roles, array[]::text[])     as roles,
             'admin' = any(coalesce(r.roles, array[]::text[])) as is_admin
      from auth.users u
      left join public.profiles p       on p.user_id = u.id
      left join public.user_settings s  on s.user_id = u.id
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
        'totalSuspended', (select count(*) from base where banned_until > now())
      )
    )
  $q$, v_sort, v_dir)
  into v_result
  using v_pat, coalesce(p_role, ''), coalesce(p_verified, ''), coalesce(p_status, ''), v_limit, v_offset;

  return v_result;
end
$fn$;

-- 2. Analytics core: retention, churn risk, top users, lifecycle, revenue ----
create or replace function public.admin_analytics_core()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  with live as (
    select id, email::text as email, created_at, last_sign_in_at
    from auth.users where deleted_at is null
  ),
  tx as (
    select user_id, count(*) as n
    from (select user_id from public.expenses
          union all select user_id from public.incomes) t
    group by user_id
  ),
  latest_sub as (
    select distinct on (user_id) user_id, status
    from public.subscriptions order by user_id, created_at desc
  ),
  months as (
    select ms, ms + interval '1 month' as me
    from generate_series(date_trunc('month', now()) - interval '5 months',
                         date_trunc('month', now()), interval '1 month') ms
  ),
  subs as (select * from public.subscriptions)
  select jsonb_build_object(
    'retentionFunnel', jsonb_build_object(
      'registered',       (select count(*) from live),
      'withTransactions', (select count(*) from tx),
      'activeIn30d',      (select count(*) from live where last_sign_in_at >= now() - interval '30 days')
    ),
    'churnRiskUsers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'email', coalesce(l.email, 'Unknown'),
               'lastActive', l.last_sign_in_at,
               'subscriptionStatus', coalesce(ls.status, 'none'),
               'joinedAt', l.created_at) order by l.last_sign_in_at desc)
      from (select l.* from live l join tx on tx.user_id = l.id
            where l.last_sign_in_at < now() - interval '14 days'
            order by l.last_sign_in_at desc limit 20) l
      left join latest_sub ls on ls.user_id = l.id
    ), '[]'::jsonb),
    'topUsers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.user_id, 'email', coalesce(l.email, 'Unknown'),
               'transactionCount', t.n, 'lastActive', l.last_sign_in_at,
               'subscriptionStatus', coalesce(ls.status, 'none')) order by t.n desc)
      from (select * from tx order by n desc limit 10) t
      left join live l on l.id = t.user_id
      left join latest_sub ls on ls.user_id = t.user_id
    ), '[]'::jsonb),
    'subscriptionLifecycle', coalesce((
      select jsonb_agg(jsonb_build_object(
               'month', to_char(m.ms, 'Mon YY'),
               'active',    (select count(*) from subs s where s.created_at < m.me and s.status = 'active'),
               'trialing',  (select count(*) from subs s where s.trial_start < m.me and s.status = 'trialing'),
               'cancelled', (select count(*) from subs s where s.cancelled_at >= m.ms and s.cancelled_at < m.me)
             ) order by m.ms)
      from months m
    ), '[]'::jsonb),
    'revenue', jsonb_build_object(
      'activeSubscriptions', (select count(*) from subs where status = 'active'),
      'totalSubscriptions',  (select count(*) from subs),
      'trialConversionRate', coalesce((
        select round(100.0 * count(*) filter (where status = 'active')
                     / nullif(count(*) filter (where status in ('active', 'cancelled', 'expired')), 0), 1)
        from subs), 0)
    )
  )
$fn$;

-- 3. Service role only ---------------------------------------------------------
revoke all on function public.admin_list_users(text, text, text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.admin_analytics_core() from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, text, text, text, text, int, int) to service_role;
grant execute on function public.admin_analytics_core() to service_role;

-- Rollback:
--   drop function public.admin_list_users(text, text, text, text, text, text, int, int);
--   drop function public.admin_analytics_core();
