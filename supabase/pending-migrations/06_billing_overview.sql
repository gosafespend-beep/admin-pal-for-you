-- 06_billing_overview.sql
--
-- NOT applied automatically. Additive; safe to apply before the matching
-- edge function and frontend are deployed (nothing calls it yet).
--
-- One place that answers "what is the billing situation?" across Paystack
-- (web), the App Store / Google Play (via RevenueCat) and manually granted
-- access, using the same rules the user list uses for plan:
--
--   paid     Paystack subscription with a provider code, or an active,
--            production, non-trial store entitlement
--   trial    a trial that has NOT yet ended (status alone is not trusted:
--            rows stay "trialing" long after trial_end passes)
--   granted  active with no billing provider (comp access)
--
-- Revenue is an ESTIMATE from list prices in plan_pricing. Store prices vary
-- by country and the real figures live in the stores / RevenueCat; sandbox
-- purchases are never counted.

create or replace function public.admin_billing_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  with
  d as (select monthly_price from public.plan_pricing where plan_type = 'default'),
  subs as (
    select s.*,
           (s.status = 'active'   and s.paystack_subscription_code is not null) as is_paystack_paid,
           (s.status = 'active'   and s.paystack_subscription_code is null)     as is_granted,
           (s.status = 'trialing' and s.trial_end >  now())                     as is_live_trial,
           (s.status = 'trialing' and s.trial_end <= now())                     as is_stale_trial
    from public.subscriptions s
  ),
  rc as (
    select r.*,
           (r.is_active and r.environment = 'PRODUCTION' and coalesce(r.period_type, '') <> 'trial') as is_store_paid,
           (r.is_active and r.environment = 'PRODUCTION' and r.period_type = 'trial')                as is_store_trial,
           (r.environment = 'SANDBOX')                                                              as is_sandbox
    from public.revenuecat_entitlements r
  ),
  ps as (
    select count(*) as n,
           coalesce(sum(coalesce(p.monthly_price, (select monthly_price from d))), 0) as mrr
    from subs s left join public.plan_pricing p on p.plan_type = s.plan_type
    where s.is_paystack_paid
  ),
  st as (
    select count(*) as n,
           coalesce(sum(case
             when product_id ilike '%annual%' or product_id ilike '%year%'
               then (select monthly_price from public.plan_pricing where plan_type = 'annual')
             when product_id ilike '%month%'
               then (select monthly_price from public.plan_pricing where plan_type = 'monthly')
             else (select monthly_price from d) end), 0) as mrr
    from rc where is_store_paid
  ),
  soon as (
    select 'web' as source, s.user_id, s.trial_end as ends_at from subs s
      where s.is_live_trial and s.trial_end < now() + interval '7 days'
    union all
    select 'store', r.user_id, r.expires_at from rc r
      where r.is_store_trial and r.expires_at < now() + interval '7 days'
  ),
  stale as (select s.user_id, s.trial_end from subs s where s.is_stale_trial),
  noend as (select s.user_id from subs s where s.is_paystack_paid and s.current_period_end is null)
  select jsonb_build_object(
    'currency', 'USD',
    'estimate', true,
    'mrr', jsonb_build_object(
      'paystack', (select mrr from ps), 'store', (select mrr from st),
      'total', (select mrr from ps) + (select mrr from st)),
    'arr', ((select mrr from ps) + (select mrr from st)) * 12,
    'customers', jsonb_build_object(
      'paystack', (select n from ps), 'store', (select n from st),
      'granted',  (select count(*) from subs where is_granted),
      'liveTrials', (select count(*) from subs where is_live_trial) + (select count(*) from rc where is_store_trial),
      'staleTrials', (select count(*) from stale),
      'sandboxIgnored', (select count(*) from rc where is_sandbox)),
    'last30d', jsonb_build_object(
      'trialsStarted', (select count(*) from subs where trial_start >= now() - interval '30 days'),
      'cancellations', (select count(*) from subs where cancelled_at >= now() - interval '30 days'),
      'storeExpirations', (select count(*) from rc where not is_sandbox and status = 'expired'
                            and coalesce(period_type, '') <> 'trial' and expires_at >= now() - interval '30 days')),
    'trialToPaid', jsonb_build_object(
      'trialsEnded', (select count(*) from subs where trial_end <= now()),
      'converted',   (select count(*) from subs where trial_end <= now() and is_paystack_paid)),
    'trialsEndingSoon', coalesce((
      select jsonb_agg(jsonb_build_object('source', x.source, 'userId', x.user_id, 'email', u.email::text, 'endsAt', x.ends_at) order by x.ends_at)
      from (select * from soon order by ends_at limit 10) x left join auth.users u on u.id = x.user_id), '[]'::jsonb),
    'attention', jsonb_build_object(
      'staleTrials', jsonb_build_object(
        'count', (select count(*) from stale),
        'sample', coalesce((select jsonb_agg(jsonb_build_object('userId', x.user_id, 'email', u.email::text, 'trialEnd', x.trial_end) order by x.trial_end desc)
                            from (select * from stale order by trial_end desc limit 5) x
                            left join auth.users u on u.id = x.user_id), '[]'::jsonb)),
      'paidWithoutPeriodEnd', jsonb_build_object(
        'count', (select count(*) from noend),
        'sample', coalesce((select jsonb_agg(jsonb_build_object('userId', x.user_id, 'email', u.email::text))
                            from (select * from noend limit 5) x
                            left join auth.users u on u.id = x.user_id), '[]'::jsonb)))
  )
$fn$;

revoke all on function public.admin_billing_overview() from public, anon, authenticated;
grant execute on function public.admin_billing_overview() to service_role;

-- Rollback:
--   drop function public.admin_billing_overview();
