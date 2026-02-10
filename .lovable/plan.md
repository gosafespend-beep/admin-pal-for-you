

# Admin Panel Enhancement: Decision-Making and User Management Power Tools

## Overview
The current admin panel has solid foundations (users, subscriptions, transactions, waitlist, settings). This plan adds the missing pieces that make it genuinely useful for day-to-day platform management and data-driven decision making.

## What's Missing and What We'll Add

### 1. Analytics Page (New) -- The Decision-Making Hub

A dedicated Analytics page in the sidebar providing actionable insights:

- **Retention Funnel**: Show signup-to-active conversion (registered users vs users with at least 1 transaction vs users active in last 30 days)
- **Churn Risk Table**: Users who were active but haven't logged in for 14+ days, with their last activity date and subscription status -- lets admin decide who to reach out to
- **Revenue Metrics**: MRR estimate based on active paid subscriptions, trial-to-paid conversion rate trend over time
- **Subscription Lifecycle Chart**: A stacked bar or area chart showing active/trialing/cancelled/expired over the last 6 months
- **Top Users by Activity**: Table of most active users (by transaction count) to identify power users and potential advocates

### 2. Audit Log (New) -- Track Admin Actions

Every admin action (suspend user, extend trial, promote/demote, revoke session, change subscription status, approve/reject waitlist) should be logged and visible:

- New `admin_audit_log` database table: `id, admin_user_id, action, target_type, target_id, details (jsonb), created_at`
- Audit Log page showing a filterable timeline of all admin actions
- Helps with accountability and debugging ("who cancelled that subscription?")

### 3. Bulk Actions on Users Page

- Checkbox selection on the Users table
- Bulk actions bar: "Suspend Selected", "Send Confirmation Email", "Export Selected"
- Speeds up management when dealing with multiple users (e.g., suspending spam accounts)

### 4. Dashboard Alerts/Notifications Banner

At the top of the Dashboard, show actionable alerts based on data:

- "X users have expiring trials in the next 3 days" (with link to filter them)
- "X waitlist entries pending review" (with link)
- "Y users haven't verified their email in 7+ days"
- These are computed from existing data in the admin-stats edge function

### 5. User Detail -- Quick Notes/Tags

- Add ability for admins to tag users (e.g., "VIP", "Churning", "Spam") and add internal notes
- New `admin_user_notes` table: `id, user_id, admin_id, note, tag, created_at`
- Visible on the UserDetail page and filterable on the Users page
- Enables team coordination and institutional memory

### 6. Email Actions from Admin Panel

- "Send Email" button on UserDetail page that opens a compose form
- Uses existing Resend API key (already configured) via an edge function
- Pre-built templates: Welcome, Trial Expiring Reminder, Account Suspended Notice
- Useful for re-engaging churning users or communicating with specific users

---

## Technical Details

### New Database Tables

**`admin_audit_log`**
- `id` (uuid, PK)
- `admin_user_id` (uuid, references auth.users)
- `action` (text) -- e.g., 'suspend_user', 'extend_trial', 'approve_waitlist'
- `target_type` (text) -- e.g., 'user', 'subscription', 'waitlist'
- `target_id` (text)
- `details` (jsonb) -- additional context
- `created_at` (timestamptz)
- RLS: admin-only read access

**`admin_user_notes`**
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users)
- `admin_id` (uuid, references auth.users)
- `note` (text)
- `tag` (text, nullable) -- 'VIP', 'Churning', 'Spam', etc.
- `created_at` (timestamptz)
- RLS: admin-only read/write

### New Files

- `src/pages/admin/Analytics.tsx` -- Analytics dashboard page
- `src/pages/admin/AuditLog.tsx` -- Audit log timeline page
- `src/hooks/admin/useAdminAnalytics.ts` -- Hook for analytics data
- `src/hooks/admin/useAdminAuditLog.ts` -- Hook for audit log
- `src/hooks/admin/useAdminUserNotes.ts` -- Hook for user notes/tags
- `src/hooks/admin/useAdminEmail.ts` -- Hook for sending emails
- `src/components/admin/DashboardAlerts.tsx` -- Alerts banner component
- `src/components/admin/UserNotes.tsx` -- Notes/tags component for UserDetail
- `src/components/admin/BulkActionsBar.tsx` -- Floating bar for bulk user actions
- `supabase/functions/admin-analytics/index.ts` -- Analytics data edge function
- `supabase/functions/admin-audit-log/index.ts` -- Audit log CRUD edge function
- `supabase/functions/admin-user-notes/index.ts` -- User notes CRUD edge function
- `supabase/functions/admin-send-email/index.ts` -- Email sending edge function

### Modified Files

- `src/pages/admin/Dashboard.tsx` -- Add DashboardAlerts banner at top
- `src/pages/admin/Users.tsx` -- Add checkbox column, bulk actions bar, tag filter
- `src/pages/admin/UserDetail.tsx` -- Add UserNotes section, Send Email button
- `src/components/admin/AdminSidebar.tsx` -- Add Analytics and Audit Log nav items
- `src/App.tsx` -- Add routes for Analytics and AuditLog pages
- `supabase/config.toml` -- Register new edge functions
- All existing admin edge functions that perform actions (admin-user-actions, admin-subscriptions, admin-waitlist) -- Add audit log writes after each action

### Migration

One migration to create both new tables with RLS policies:

```text
-- admin_audit_log table
CREATE TABLE admin_audit_log (...)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit log" ON admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit log" ON admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_user_notes table  
CREATE TABLE admin_user_notes (...)
ALTER TABLE admin_user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage notes" ON admin_user_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### Implementation Order

1. Database migration (audit log + user notes tables)
2. Analytics page + edge function (highest value for decision-making)
3. Dashboard alerts banner (uses existing stats data)
4. Audit log page + integrate logging into existing action edge functions
5. User notes/tags on UserDetail + tag filter on Users
6. Bulk actions on Users page
7. Email sending functionality

