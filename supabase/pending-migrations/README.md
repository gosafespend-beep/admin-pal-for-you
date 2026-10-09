# Pending migrations (not applied automatically)

These are kept out of `supabase/migrations/` on purpose: applying them in the
wrong order, or before the matching code is live, locks the admin out or breaks
a screen. Apply by hand, in this order.

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 1 | `01_close_audit_bypass.sql` | After the Phase 0 edge functions are **deployed** and the new frontend is live | Admin sessions can no longer write `user_roles`, `admin_user_notes` or `admin_audit_log` directly; audit log becomes append-only; role changes are audited by the database |
| 2 | `02_enforce_admin_mfa.sql` | After every admin has enrolled an authenticator app **and** a break-glass plan exists | `is_admin()` always requires AAL2 |

## Deploy order for Phase 0

1. Merge the branch (frontend deploys with it).
2. Deploy all edge functions (`admin-*`; they now share `_shared/http.ts`,
   `_shared/audit.ts`, `_shared/userActionRules.ts`).
3. Check: Users, Subscriptions, Transactions, Waitlist, Audit Log load; suspend
   and unsuspend a test account; the audit log shows `suspend`,
   `suspend_completed`, `unsuspend`, `unsuspend_completed`.
4. Apply `01_close_audit_bypass.sql`.
5. Settings > Two-factor sign-in: enrol, sign out, sign in with a code.
6. Only then consider `02_enforce_admin_mfa.sql`. There is currently a single
   admin account, so add a second admin (with their own factor) first.

## Security headers

`public/_headers` is honoured by Netlify and Cloudflare Pages. The current host
ignores it (and injects a third-party `/__l5e/events` script that a strict
`script-src 'self'` would block), so the same values must also be set where the
site is served, e.g. a Cloudflare Transform Rule on `admin.gosafespend.com`.
Test with a report-only header first:
`Content-Security-Policy-Report-Only`.

## Phase 1 migrations

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 3 | `03_server_side_admin_queries.sql` | **Before** deploying the Phase 1 `admin-users` and `admin-analytics` functions (they call it) | Adds `admin_list_users` and `admin_analytics_core`, service-role only. Additive. |
| 4 | `04_revoke_session_server_only.sql` | After the Phase 1 frontend and `admin-user-actions` are live | Browser sessions can no longer call `revoke_user_session` directly; revoking goes through the audited function |

Order for Phase 1: apply 03 → merge → deploy functions → check Users/Analytics/session revoke → apply 04.

## Phase 2 migrations

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 5 | `05_user_360.sql` | **Before** deploying the Phase 2 `admin-users`, `admin-user-detail` and `admin-user-actions` functions | Replaces `admin_list_users` with a version that adds plan / stage / platform filters (old callers keep working: new parameters default to empty) and adds `admin_user_360`. Service role only. |

Order for slice 1: apply 05 -> merge -> deploy the three functions -> check a user page and the Users filters.

## Phase 2, slice 2 (billing hub)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 6 | `06_billing_overview.sql` | **Before** deploying `admin-billing` | Adds `admin_billing_overview()` (service role only). Additive. |

Order: apply 06 -> merge -> deploy `admin-billing` (new), `admin-subscriptions`, `admin-stats`.
Note: cancelling or reactivating a Paystack subscription now calls Paystack's API
(`/subscription/disable` and `/enable`) using `PAYSTACK_SECRET_KEY`. That path has not been
exercised against a real paying customer; try it on a test subscription first.
