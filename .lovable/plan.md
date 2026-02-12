

# Performance Optimization Plan

## Root Causes Identified

### 1. Edge Function (`admin-stats`) fetches 1,000 users in-memory
The biggest bottleneck: `adminClient.auth.admin.listUsers({ perPage: 1000 })` loads up to 1,000 user objects into the edge function, then runs **7 separate `.filter()` loops** over them in JavaScript to calculate signups, active users, trends, etc. This is slow and will get worse as users grow.

### 2. Realtime subscriptions on 6 tables cause excessive re-fetching
`useAdminDashboardStats` subscribes to realtime changes on `profiles`, `expenses`, `incomes`, `transfers`, `subscriptions`, and `waitlist`. Any single row change on any of these tables triggers a full dashboard refetch (calling the expensive edge function again).

### 3. Unused hook still in codebase
`useAdminStats.ts` fetches ALL expense and income rows client-side to sum amounts. It's not imported anywhere but adds confusion.

### 4. No lazy loading of routes
All admin pages are eagerly imported in `App.tsx`, increasing the initial bundle size.

## Fixes

### Fix 1: Move user-based calculations to a SQL RPC (biggest impact)
Create a new database function `admin_user_engagement_stats` that calculates user signups, active users (7d/30d), and trends directly in SQL using the `auth.users` table. This replaces the in-memory JavaScript filtering of 1,000 user objects.

**New SQL RPC:**
```sql
CREATE OR REPLACE FUNCTION admin_user_engagement_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
```

**New SQL RPC for user signups chart (last 12 months):**
```sql
CREATE OR REPLACE FUNCTION admin_user_signups_chart()
RETURNS TABLE(month_key text, month_label text, signup_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(d, 'YYYY-MM') as month_key,
    to_char(d, 'Mon YY') as month_label,
    (SELECT count(*) FROM auth.users WHERE created_at >= d AND created_at < d + interval '1 month') as signup_count
  FROM generate_series(
    date_trunc('month', now() - interval '11 months'),
    date_trunc('month', now()),
    interval '1 month'
  ) as d;
$$;
```

### Fix 2: Update edge function to use new RPCs
Replace `listUsers` call with the two new RPCs. This eliminates the 1,000-user fetch and all JavaScript filtering.

**Changes to `supabase/functions/admin-stats/index.ts`:**
- Remove `adminClient.auth.admin.listUsers({ perPage: 1000 })`
- Add `adminClient.rpc('admin_user_engagement_stats')` and `adminClient.rpc('admin_user_signups_chart')` to the `Promise.all`
- Remove all the in-memory user filtering logic (lines 67-122)
- Build response from RPC results directly

### Fix 3: Reduce realtime subscription noise
Change the realtime subscriptions to only listen for INSERT events (not UPDATE/DELETE) since dashboard stats mainly care about new data, not modifications. Also increase `staleTime` from 30s to 60s.

**Changes to `src/hooks/admin/useAdminDashboardStats.ts`:**
- Change `event: "*"` to `event: "INSERT"` on all channels
- Increase `staleTime` to `60000` (60 seconds)

### Fix 4: Lazy load route components
Use `React.lazy()` for all page components in `App.tsx` so they load on-demand instead of all upfront.

**Changes to `src/App.tsx`:**
- Replace static imports with `React.lazy(() => import(...))`
- Wrap `Routes` in a `Suspense` boundary with a loading spinner

### Fix 5: Delete unused hook
Remove `src/hooks/admin/useAdminStats.ts` -- it's not imported anywhere and its approach (fetching all rows client-side) is the anti-pattern we're fixing.

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Create `admin_user_engagement_stats` and `admin_user_signups_chart` RPCs |
| `supabase/functions/admin-stats/index.ts` | Replace `listUsers` with RPCs, remove JS filtering |
| `src/hooks/admin/useAdminDashboardStats.ts` | Reduce realtime events to INSERT only, increase staleTime |
| `src/App.tsx` | Lazy load all page components with Suspense |
| `src/hooks/admin/useAdminStats.ts` | Delete file |

## Expected Impact
- Dashboard load time should drop significantly (SQL queries vs. fetching 1,000 user objects and filtering in JS)
- Fewer unnecessary refetches from realtime subscriptions
- Smaller initial bundle from lazy loading
- Scales properly as user count grows beyond 1,000

