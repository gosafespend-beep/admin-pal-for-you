
-- Function to calculate user engagement stats directly in SQL
CREATE OR REPLACE FUNCTION public.admin_user_engagement_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'active_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
    'active_30d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days'),
    'new_this_week', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days'),
    'current_month_signups', (SELECT count(*) FROM auth.users WHERE created_at >= date_trunc('month', now())),
    'prev_month_signups', (SELECT count(*) FROM auth.users WHERE created_at >= date_trunc('month', now() - interval '1 month') AND created_at < date_trunc('month', now()))
  ) INTO result;
  RETURN result;
END;
$$;

-- Function to get user signups chart data (last 12 months)
CREATE OR REPLACE FUNCTION public.admin_user_signups_chart()
RETURNS TABLE(month_key text, month_label text, signup_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    to_char(d, 'YYYY-MM') as month_key,
    to_char(d, 'Mon ''YY') as month_label,
    (SELECT count(*) FROM auth.users WHERE created_at >= d AND created_at < d + interval '1 month') as signup_count
  FROM generate_series(
    date_trunc('month', now() - interval '11 months'),
    date_trunc('month', now()),
    interval '1 month'
  ) as d;
$$;
