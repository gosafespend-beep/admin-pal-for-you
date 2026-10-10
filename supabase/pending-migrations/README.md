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

## Phase 2, slice 3 (growth metrics)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 7 | `07_growth_metrics.sql` | **Before** deploying `admin-metrics` | Adds `admin_growth_metrics(weeks)` (service role only). Additive. |

Order: apply 07 -> merge -> deploy `admin-metrics` (new).

## Phase 2, slice 4 (data requests)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 8 | `08_data_requests.sql` | **Before** deploying `admin-data-requests` | Creates the `data_requests` table (no policies; service role only) and four service-role-only functions (find by email, export one person's data, retention report, consent summary). Additive. |

Order: apply 08 -> merge -> deploy `admin-data-requests` (new).
Note: the table has no `user_id` column on purpose: `delete_user_data` deletes from every public table that has one, which would erase the record of the request.

## Phase 2, slice 5 (support tools)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 9 | `09_support_tools.sql` | **Before** deploying `admin-support` | Creates the `support_macros` table (no policies; service role only) with seven starter replies, and `admin_support_snapshot(user)` (service role only), which asks the app's own `can_write()` whether a person can save data. Additive. |

Order: apply 09 -> merge -> deploy `admin-support` (new).
Note: the starter replies are drafts. Read and edit them on the Support page before using them with customers.

## Phase 3, slice 1 (marketing console)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 10 | `10_marketing_overview.sql` | **Before** deploying `admin-marketing` | Adds `admin_marketing_overview()` (service role only, read-only). Reports on the `sgs_*` marketing system; never reads token values, only expiry dates. Additive. |

Order: merge PR #7 first (this branch is stacked on it) -> apply 10 -> merge -> deploy `admin-marketing` (new).

## Phase 3, slice 2 (alerting)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 11 | `11_ops_alerts.sql` | **Before** deploying `ops-monitor` and `admin-alerts` | Creates the `ops_alerts` table (no policies; service role only) and `admin_ops_signals()` (service role only). Additive. |
| 12 | `12_ops_monitor_schedule.sql` | **Last**, after both functions are deployed | Schedules `ops-monitor` every 30 minutes (secret read from Vault, same as the billing monitor). The first run emails about whatever is already wrong. Idempotent. |

Order: apply 11 -> merge -> deploy `ops-monitor` and `admin-alerts` (both new) -> apply 12.
Email uses the server's existing `RESEND_API_KEY` and `ALERT_EMAIL` (default info@gosafespend.com), the same as the billing monitor. The Alerts page says whether email is configured.
Note: the older `watchdog` function was never scheduled and its sender address is still a placeholder; `ops-monitor` replaces it.

## Phase 3, slice 3 (system health)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 13 | `13_health_signals.sql` | **Before** deploying `admin-health` and the updated `ops-monitor` / `admin-alerts` | Adds `admin_health_signals()` (service role only, read-only): database size and connections, when each automatic process last ran, failed scheduled jobs, and error answers to scheduled calls. Additive. |

Order: apply 13 -> merge -> deploy `admin-health` (new) and redeploy `ops-monitor` and `admin-alerts` (they now include the health checks).
The health checks make one cheap authenticated call each to Paystack (balance), Resend (domains) and Anthropic (model list) and return only a fixed status sentence.

## Phase 3, slice 4 (marketing pause and resume)

| # | File | Apply when | Effect |
|---|------|------------|--------|
| 15 | `15_marketing_controls.sql` | **Before** deploying the updated `admin-marketing`, `ops-monitor` and `admin-alerts` | Creates `marketing_pauses` (service role only) and four service-role-only functions that pause and resume one agent, one channel, or everything, remembering what each was so resume restores it exactly. Nothing changes until someone presses a button. |

Order: apply 15 -> merge -> redeploy `admin-marketing`, `ops-monitor`, `admin-alerts`.
What the switches do (checked against the code that obeys them): a paused agent is refused by `agent-run`; a channel switched off is skipped by `publish-direct`. Posts already scheduled for a channel that is off are marked failed by `social-release`. TikTok, X and YouTube go through Buffer and are controlled by the separate `distribute_*` settings, not by these switches.
