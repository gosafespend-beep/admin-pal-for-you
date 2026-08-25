
CREATE OR REPLACE FUNCTION public.admin_event_funnel()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'activation', (
      SELECT jsonb_agg(x ORDER BY x->>'order')
      FROM (
        SELECT jsonb_build_object('order','1','step','welcome_start','count',(SELECT count(*) FROM analytics_events WHERE event='welcome_start')) x
        UNION ALL SELECT jsonb_build_object('order','2','step','welcome_complete','count',(SELECT count(*) FROM analytics_events WHERE event='welcome_complete'))
        UNION ALL SELECT jsonb_build_object('order','3','step','signup','count',(SELECT count(*) FROM analytics_events WHERE event='signup'))
        UNION ALL SELECT jsonb_build_object('order','4','step','onboarding_complete','count',(SELECT count(*) FROM analytics_events WHERE event='onboarding_complete'))
        UNION ALL SELECT jsonb_build_object('order','5','step','first_transaction','count',(SELECT count(*) FROM analytics_events WHERE event='first_transaction'))
      ) s
    ),
    'monetization', (
      SELECT jsonb_agg(x ORDER BY x->>'order')
      FROM (
        SELECT jsonb_build_object('order','1','step','paywall_view','count',(SELECT count(*) FROM analytics_events WHERE event='paywall_view')) x
        UNION ALL SELECT jsonb_build_object('order','2','step','plan_select','count',(SELECT count(*) FROM analytics_events WHERE event='plan_select'))
        UNION ALL SELECT jsonb_build_object('order','3','step','checkout_start','count',(SELECT count(*) FROM analytics_events WHERE event='checkout_start'))
        UNION ALL SELECT jsonb_build_object('order','4','step','purchase_success','count',(SELECT count(*) FROM analytics_events WHERE event IN ('purchase_success','purchase_complete','restore')))
      ) s2
    ),
    'purchaseOutcomes', jsonb_build_object(
      'cancel', (SELECT count(*) FROM analytics_events WHERE event='purchase_cancel'),
      'fail', (SELECT count(*) FROM analytics_events WHERE event='purchase_fail'),
      'restore', (SELECT count(*) FROM analytics_events WHERE event='restore')
    ),
    'abandonBySteps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('step', step, 'count', c) ORDER BY c DESC)
      FROM (
        SELECT COALESCE(NULLIF(props->>'step',''), 'unknown') AS step, count(*) AS c
        FROM analytics_events
        WHERE event = 'onboarding_abandon'
        GROUP BY 1
        LIMIT 20
      ) a
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_event_timeseries(p_days integer DEFAULT 30)
RETURNS TABLE(day date, event text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT (ae.created_at AT TIME ZONE 'UTC')::date AS day, ae.event, count(*)::bigint
  FROM analytics_events ae
  WHERE ae.created_at >= now() - (GREATEST(LEAST(p_days, 365), 1) || ' days')::interval
  GROUP BY 1, 2
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_feature_usage()
RETURNS TABLE(event text, total bigint, unique_users bigint, unique_sessions bigint, last_seen timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT ae.event,
         count(*)::bigint,
         count(DISTINCT ae.user_id)::bigint,
         count(DISTINCT ae.session_id)::bigint,
         max(ae.created_at)
  FROM analytics_events ae
  GROUP BY ae.event
  ORDER BY 2 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_data_health()
RETURNS TABLE(source text, row_count bigint, last_record timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 'analytics_events'::text, count(*)::bigint, max(created_at) FROM analytics_events
  UNION ALL SELECT 'activation_events', count(*)::bigint, max(created_at) FROM activation_events
  UNION ALL SELECT 'notification_log', count(*)::bigint, max(sent_at) FROM notification_log
  UNION ALL SELECT 'fx_rates', count(*)::bigint, max(fetched_at) FROM fx_rates
  UNION ALL SELECT 'monthly_reports', count(*)::bigint, max(created_at) FROM monthly_reports
  UNION ALL SELECT 'revenuecat_entitlements', count(*)::bigint, max(updated_at) FROM revenuecat_entitlements
  UNION ALL SELECT 'subscriptions', count(*)::bigint, max(created_at) FROM subscriptions
  UNION ALL SELECT 'profiles', count(*)::bigint, max(created_at) FROM profiles
  UNION ALL SELECT 'profiles_with_acquisition', count(*) FILTER (WHERE acquisition_source IS NOT NULL)::bigint, max(acquired_at) FROM profiles
  UNION ALL SELECT 'admin_audit_log', count(*)::bigint, max(created_at) FROM admin_audit_log;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_event_funnel() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_event_timeseries(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_feature_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_data_health() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_event_funnel() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_event_timeseries(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_feature_usage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_data_health() TO authenticated, service_role;
