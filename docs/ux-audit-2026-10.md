# Admin panel UX and accessibility audit, October 2026

Evidence comes from the live site (admin.gosafespend.com), the code, and automated checks. Nothing here is a guess; items that could not be verified are listed as such.

## What was checked

- The dashboard as rendered, a read-only structural accessibility pass in the browser (landmarks, names, labels, headings, targets), and the browser console.
- Bundle size from a production build.
- The shell code: layout, sidebar, command search, dashboard, error handling.
- `eslint` and CI configuration.

## Findings and what was done (batch 1)

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| 1 | The dashboard hid what is wrong. The only "Worth a look" item was the waitlist count while posting had been down for 16 days. | Screenshot and `Dashboard.tsx` | **Fixed**: a "needs your attention" panel at the top, drawn from the same monitor that emails you, quiet when all is well |
| 2 | The same figures appeared more than once (Active 30 days twice, active subscriptions three times) and the page spent space on "Refreshes every 5 minutes". | Screenshot | **Fixed**: one row of key numbers, one subscriptions row, an "Updated HH:MM" line and a Refresh button |
| 3 | A red "-42.9%" on Total users compared signups so far this month with a whole previous month, so it looks like a collapse early in any month. | `admin-stats` code | **Fixed in the page** (shows "5 signups so far this month, 12 last month"); the function also returns the plain numbers. Needs `admin-stats` redeployed to show them. |
| 4 | Subscriptions showed 12 in total beside Active 1, Trialing 0, Cancelled 0, leaving 11 ended trials unexplained. | Screenshot | **Fixed**: a "Trial ended, not subscribed" tile; the tiles now add up |
| 5 | Two nested `<main>` landmarks and no `<nav>` landmark. | In-browser pass and `AdminLayout.tsx` | **Fixed** |
| 6 | No skip link; no page title per route; focus stayed on the old link after a page change. | In-browser pass | **Fixed**: skip link, per-page tab title, focus moves to the content, polite announcement of the new page |
| 7 | Icon-only buttons without names (sidebar collapse and sign-out when collapsed). | In-browser pass | **Fixed** |
| 8 | A crash in one page would blank the panel with the framework's default error. | `App.tsx` has no error handling | **Fixed**: a per-page boundary that keeps the menu usable and recovers on navigation, plus a root error page |
| 9 | Open alerts were invisible unless you opened the Alerts page. | Sidebar | **Fixed**: a count badge on the Alerts menu item, readable by screen readers |
| 10 | The search box only found pages. | `AdminSearch.tsx` | **Fixed**: type a name, email or ID in the Ctrl/Cmd-K box to jump to a person |
| 11 | Lint reported 24 errors and was not run in CI. | `eslint .` | **Fixed**: generated and Deno files get their own rules, real problems fixed, lint added to CI |
| 12 | No automated accessibility checks. | `package.json` | **Added**: axe tests for the sidebar, attention panel and error boundary |

Checked and **not** a problem: 24 "images without alt text" turned out to belong to a browser extension, not the app. No console errors on the dashboard. The main JavaScript bundle is 189 kB compressed, which is reasonable.

## Not yet done (backlog, in suggested order)

1. **Colour contrast.** Cannot be judged without a real browser engine; run Lighthouse against the key pages and fix what it flags.
2. **Light theme and a theme toggle.** The panel is dark only. Needs a second set of colour tokens and a pass over every page.
3. **Shared page header.** Each page builds its own title row. A shared component would make titles, descriptions and actions consistent.
4. **Narrow screens.** Newer pages scroll tables sideways. Older pages use stacked cards. Pick one pattern and apply it everywhere. This needs checking on a real phone-width viewport; the browser tool here could not emulate one.
5. **Keyboard operation of tables.** Rows that open a detail view should be reachable and operable from the keyboard.
6. **End-to-end smoke tests (Playwright).** Needs a dedicated test admin account with two-step sign-in handled, which does not exist yet.
7. **Error and performance monitoring (Sentry).** Needs a Sentry project and key.
8. **Blog editor (CMS v2).** Revisions and restore, trash instead of hard delete, a media library, and safer Markdown handling.
9. **Dependency advisories.** `npm audit` reports high-severity advisories carried over from before; schedule an upgrade pass.
