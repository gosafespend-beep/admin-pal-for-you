

# Admin Panel Refocus: From User Data to Administrative Management

## Problem
The current admin panel is bloated with user-specific financial details (savings goals, debt balances, net worth, budgets, bills, recurring transactions) that belong in the user-facing app. A real admin panel should focus on platform management: user lifecycle, subscriptions/revenue, engagement analytics, and system operations.

## What Changes

### 1. Dashboard Overhaul -- Remove Financial Clutter, Add Admin Metrics

**Remove from Dashboard:**
- "Financial Overview" section (individual expense/income/debt totals)
- "Savings Progress" card (goals completed, progress bars)
- Quick stats strip showing Accounts, Bills, Debts, Goals, Transfers, Categories
- Net Worth, Budgets, Active Recurring cards
- Category Distribution chart (user-level data)

**Replace with:**
- **Revenue/Subscription metrics row**: Active subscriptions, trial conversion rate, MRR estimate, churn count
- **Engagement metrics**: Daily/weekly active users (based on last_sign_in_at), avg transactions per user, new signups this week
- **Platform health summary**: inline indicators for system status pulled from settings health check
- Keep: Total Users, Transaction Volume chart (useful for platform growth), User Growth chart, Recent Activity, Waitlist count

### 2. UserDetail Page -- Simplify to Administrative View

**Remove tabs:**
- Bills tab
- Budgets tab  
- Recurring Transactions tab
- Net Worth snapshots
- Goals tab (savings goals)
- Accounts tab details
- Debts tab

**Keep/Add:**
- User profile card with status, role, subscription info
- Admin actions (suspend, delete, promote, demote)
- **Activity summary**: total transaction count, last active date, account age
- **Subscription tab**: show subscription status, trial dates, plan details
- **Sessions tab**: show active sessions with ability to revoke (already have RPCs for this)
- Recent transactions (last 10, read-only, for context)

### 3. Subscriptions Page -- Enhance for Revenue Management

The existing Subscriptions page is good. Enhance with:
- Add ability to manually change subscription status (extend trial, cancel, reactivate)
- Show revenue/MRR calculation in stats cards

### 4. Dashboard Stats Hook/Edge Function -- Trim Data

Update `admin-stats` edge function and `useAdminDashboardStats` to stop returning:
- Debt balances, savings goals, completed goals, savings progress/target
- Budget counts, recurring transaction details
- Asset/liability/net worth totals
- Debt payment counts, goal contribution counts

Instead return:
- Subscription metrics (active, trialing, cancelled, conversion rate)
- Engagement metrics (users active in last 7d, 30d)
- Simplified transaction volume (just totals for the chart)

### 5. Sidebar -- Already Clean (No Changes Needed)

The sidebar already has the right structure: Dashboard, Users, Transactions, Subscriptions, Waitlist, Settings.

---

## Technical Details

### Files to Modify

**`src/pages/admin/Dashboard.tsx`**
- Remove Financial Overview section (lines 248-289)
- Remove Savings Progress card (lines 302-362)
- Remove Quick Stats strip with user-data metrics (lines 176)
- Remove New Metrics Row showing recurring/budgets/net worth (lines 179-234)
- Replace with subscription and engagement metrics cards
- Keep: primary stats (Users, Transactions, Volume, Waitlist), Transaction Volume chart, User Growth chart, Recent Activity

**`src/hooks/admin/useAdminDashboardStats.ts`**
- Simplify `DashboardStats` interface to remove `features` bloat
- Add engagement and subscription fields

**`supabase/functions/admin-stats/index.ts`**
- Remove queries for: debts, savings_goals, categories, bills, assets, liabilities, networth, debt_payments, goal_contributions, budgets
- Add: active users in last 7d/30d query (from auth.users last_sign_in_at), subscription conversion rate
- Keep: user count, transaction aggregation, monthly chart data, recent activity, waitlist count

**`src/pages/admin/UserDetail.tsx`**
- Remove Bills, Budgets, Recurring, Goals, Debts, Accounts tabs
- Simplify to: Overview (profile + admin actions), Subscription, Sessions, Recent Transactions
- Add sessions management using existing `list_user_sessions` and `revoke_user_session` RPCs

**`src/hooks/admin/useAdminUserDetail.ts`**
- Remove fetching of bills, budgets, recurring_transactions, networth_snapshots, savings_goals, debts, accounts detail
- Add session fetching

**`supabase/functions/admin-user-detail/index.ts`**
- Remove queries for bills, budgets, recurring, goals, debts, accounts
- Add: user session data, subscription detail, basic activity summary (transaction counts)

**`supabase/functions/admin-subscriptions/index.ts`**
- Add POST handler for status changes (extend trial, cancel, reactivate)

**`src/pages/admin/Subscriptions.tsx`**
- Add action dropdown per subscription row for status management

### No Changes Needed
- `Users.tsx` -- already properly focused on user management
- `Transactions.tsx` -- already properly focused on platform transactions
- `Waitlist.tsx` -- already properly focused
- `Settings.tsx` -- already properly focused
- `AdminSidebar.tsx` -- navigation is already correct
- `AdminLayout.tsx` -- layout is fine

