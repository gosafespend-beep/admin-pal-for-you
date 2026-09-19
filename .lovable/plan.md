# Ebook Offer Dashboard in the Admin Panel

The customer app and landing page now collect ebook-offer data into the shared Supabase project (`ebook_leads`, `ebook_events`) and expose one admin-only summary: `admin_ebook_stats(p_days integer default 30)` — SECURITY DEFINER, raises "not authorized" for non-admins. Verified: the RPC exists and there are already 2 leads.

## What to build

A new **Ebook Offer** page in the admin panel (Insights group), reading the RPC directly from the client — no new edge function needed since the RPC is already admin-gated server-side.

### Page: `src/pages/admin/Ebook.tsx`

1. **Range switch** — 7 / 30 / 90 days, re-calls `admin_ebook_stats(days)` on change.
2. **Four metric cards** (existing `StatsCard` pattern):
   - **Book requests** — `totals.requests` total, with `requests_in_window` for the selected range
   - **Opened the link** — `opens.unique_emails`, shown as a % of requests, plus `opens.total` clicks
   - **Finished the series** — `totals.series_completed` as a % of `series_started`
   - **Opted out** — `totals.unsubscribed` as a % of requests
3. **Daily area chart** — requests vs opens over time from `daily: [{day, requests, opens}]`, following the existing `EventTrendChart` / recharts pattern with HSL tokens.
4. **Two lists**:
   - Requests by source (`by_source`)
   - Leads by email-series stage (`by_stage`, stage 0 = book only, 1–4 = emails sent)
5. **Error handling** via the standard `AdminErrorState` with retry.

### Navigation

- Add route `/ebook` to `App.tsx` (flat routing, lazy-loaded like other pages).
- Add a "Ebook" nav item (BookOpen icon) under the **Insights** group in `sidebarNavItems.ts`.

### Hook

- New `src/hooks/admin/useAdminEbook.ts` — react-query hook calling `supabase.rpc('admin_ebook_stats', { p_days: days })` with typed response matching the JSON shape:
  ```
  totals: { requests, requests_in_window, unsubscribed, series_started, series_completed }
  opens:  { total, unique_emails, in_window }
  by_source: [{ source, requests }]
  by_stage:  [{ stage, leads }]
  daily:     [{ day, requests, opens }]
  ```

## Technical notes

- No database changes — tables, RPC, and RLS already exist and are admin-read only.
- No new edge function — the RPC's own `is_admin()`/role check is the authorization; the page sits behind the existing `AdminLayout` guard like every other page.
- Percentages computed client-side from the returned totals; everything else renders as-is.
- Follows existing conventions: dark glassmorphism cards, multi-colour HSL dataviz tokens, 60s stale time.

## Files

| File | Change |
|---|---|
| `src/pages/admin/Ebook.tsx` | New page (new) |
| `src/hooks/admin/useAdminEbook.ts` | New react-query hook (new) |
| `src/components/admin/charts/EbookDailyChart.tsx` | Requests vs opens area chart (new) |
| `src/App.tsx` | Lazy route `/ebook` |
| `src/components/admin/sidebar/sidebarNavItems.ts` | Insights nav item |

No changes to Supabase migrations, edge functions, or the customer app.
