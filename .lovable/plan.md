
# Route Cleanup: Remove `/admin` Prefix from All Routes

## Problem
Since this is an admin-only application, nesting every route under `/admin` is redundant. Routes like `/admin/users` should just be `/users`, `/admin/transactions` should be `/transactions`, etc. The login page should be `/login`.

## What Changes

Every `/admin/...` path becomes a top-level path. The layout wrapper moves from `/admin` to `/` (root).

### Route Mapping

```text
/admin/login        -->  /login
/admin              -->  /dashboard
/admin/users        -->  /users
/admin/users/:id    -->  /users/:id
/admin/transactions -->  /transactions
/admin/subscriptions --> /subscriptions
/admin/analytics    -->  /analytics
/admin/waitlist     -->  /waitlist
/admin/audit-log    -->  /audit-log
/admin/settings     -->  /settings
```

Note: The root `/admin` (Dashboard) moves to `/dashboard` so the layout wrapper can sit at `/` cleanly.

### Files to Modify (7 files)

**1. `src/App.tsx`** -- Restructure all route definitions
- `/login` for AdminLogin
- `AdminLayout` wraps `/` with child routes: `dashboard`, `users`, `users/:id`, `transactions`, `subscriptions`, `analytics`, `waitlist`, `audit-log`, `settings`
- Remove the old `Index` page route (or redirect `/` to `/dashboard`)

**2. `src/components/admin/AdminLayout.tsx`**
- Change redirect from `/admin/login` to `/login`

**3. `src/hooks/admin/useAdminAuth.ts`**
- Change sign-out redirect from `/admin/login` to `/login`

**4. `src/components/admin/AdminSidebar.tsx`**
- Update all `mainNavItems` URLs: `/admin` to `/dashboard`, `/admin/users` to `/users`, etc.
- Update `settingsNavItems`: `/admin/settings` to `/settings`
- Update `isActive` logic to check `/dashboard` instead of `/admin`

**5. `src/components/admin/AdminSearch.tsx`**
- Update all `pages` paths from `/admin/...` to top-level paths

**6. `src/components/admin/AdminBreadcrumbs.tsx`**
- Update root path from `/admin` to `/dashboard`
- Remove the special `admin` segment handling
- Update `routeLabels` to include `dashboard: "Dashboard"`

**7. `src/components/admin/DashboardAlerts.tsx`**
- Update link paths: `/admin/subscriptions` to `/subscriptions`, `/admin/waitlist` to `/waitlist`, `/admin/analytics` to `/analytics`

**8. `src/pages/admin/UserDetail.tsx`**
- Update back-navigation from `/admin/users` to `/users`

**9. `src/pages/admin/AdminLogin.tsx`**
- Update post-login redirect from `/admin` to `/dashboard`

No edge functions or database changes needed -- this is purely a frontend routing cleanup.
