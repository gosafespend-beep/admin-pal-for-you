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
