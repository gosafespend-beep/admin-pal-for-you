# Close the Tracking Gaps in the Admin Panel

I queried the live database and compared every table against what the admin panel actually reads. Four real gaps came back.

## What the data shows

| Table | Rows | Status |
|---|---|---|
| `analytics_events` | 936 (latest Aug 24) | Actively collected, **never shown anywhere in the admin panel** |
| `admin_audit_log` | 1 | Only 3 of 12 edge functions write to it |
| `profiles.acquisition_*` | 0 of 9 filled | Attribution columns exist but are always NULL |
| `activation_events` | 0 | Table exists, nothing ever writes to it |
| `revenuecat_entitlements` | 1 row + unused `entitlement_health()` RPC | No admin surface |
| `notification_log` | 0 | No admin surface (and nothing writing) |

The product funnel is fully instrumented in the main app but invisible to you: 123 `welcome_start`, 69 `welcome_complete`, 49 `onboarding_complete`, 36 `onboarding_abandon`, 67 `paywall_view`, 11 `checkout_start`, 9 `purchase_cancel`, 1 `purchase_fail`. None of that reaches the Analytics page, which today only derives numbers from `subscriptions`, `expenses` and `incomes`.

## Plan

### 1. Product funnel analytics (biggest win)
Add a **Product Analytics** section to the Analytics page, backed by new SQL aggregation:

- Acquisition to activation funnel: `welcome_start` to `welcome_complete` to `signup` to `onboarding_complete` to `first_transaction`, with drop-off percentage per step.
- Paywall / checkout funnel: `paywall_view` to `plan_select` to `checkout_start` to purchase outcome, showing cancel and fail rates.
- Event volume over time (daily/weekly), filterable by event name.
- Feature usage counts (`coach_open`, `coach_message`, `statement_import_*`, `tour_open`, `restore`).
- Onboarding abandon breakdown by the step recorded in `props`.

Aggregation runs as security-definer SQL functions in the database (per project convention), read through the existing `admin-analytics` edge function.

### 2. Complete the audit trail
Right now blog edits, waitlist actions and role changes leave no trace, which breaks the rule that every admin action is logged. Add `admin_audit_log` inserts to:

- `admin-blog` (create, update, publish, delete)
- `admin-waitlist` (status changes, launch emails)
- `admin-settings` (role grant/revoke - currently unlogged despite touching `user_roles`)
- `admin-user-detail` and `admin-transactions` for sensitive reads, if you want read auditing too (optional, say the word)

### 3. Entitlement and billing health
Add a panel to the Subscriptions page that calls the existing but unused `entitlement_health()` RPC, and shows RevenueCat entitlements alongside Paystack subscriptions so mismatches between the two providers surface.

### 4. Report the empty pipelines honestly
`activation_events`, `notification_log` and `profiles.acquisition_*` are empty because the **main app** never writes to them - the admin panel cannot fix that. I will add a small "Data health" card on the Analytics page showing per-source freshness (last row timestamp for analytics events, fx rates, notification log, activation events), so a silent pipeline is visible instead of looking like zero usage. Fixing the writers themselves is a change in the `gosafespend` app repo, not here.

## Technical notes

- New DB functions (created in the main schema repo convention, applied via migration here only if you approve): `admin_event_funnel()`, `admin_event_timeseries(p_days int)`, `admin_feature_usage()`, `admin_data_health()`. All `security definer`, admin-gated via `is_admin()`.
- `admin-analytics` edge function extended to return a `product` block; `useAdminAnalytics` types extended accordingly.
- New chart components follow the existing `charts/` pattern and multi-colour HSL dataviz tokens.
- Audit inserts reuse the shape already used in `admin-user-actions`.

## Files affected

| File | Change |
|---|---|
| Database migration | 4 new security-definer aggregation functions |
| `supabase/functions/admin-analytics/index.ts` | Return product funnel, timeseries, feature usage, data health |
| `supabase/functions/admin-blog/index.ts` | Audit log writes |
| `supabase/functions/admin-waitlist/index.ts` | Audit log writes |
| `supabase/functions/admin-settings/index.ts` | Audit log writes on role changes |
| `supabase/functions/admin-subscriptions/index.ts` | Expose `entitlement_health()` + RevenueCat rows |
| `src/hooks/admin/useAdminAnalytics.ts` | New types and fields |
| `src/pages/admin/Analytics.tsx` | Funnel, event trend, feature usage, data health sections |
| `src/pages/admin/Subscriptions.tsx` | Entitlement health panel |
| `src/components/admin/charts/*` | New funnel and event-trend charts |
