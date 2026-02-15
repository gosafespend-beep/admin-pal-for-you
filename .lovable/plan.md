

# Comprehensive Internal Linking Plan for Blog Articles

## Overview

Add cross-links between all 4 existing blog articles wherever topics naturally overlap, and link to the Go Safe Spend app tools where relevant. This will be done by updating the `content` field of each article in the database via an edge function (same approach used previously for external links).

## Article Inventory

| # | Title | Slug | Category |
|---|-------|------|----------|
| 1 | How to Build a Budget That Actually Works in 2026 | `build-budget-that-works-2026` | Budgeting |
| 2 | How to Save Money Fast on a Low Income in 2026 | `how-to-save-money-fast-on-a-low-income-2026-practical-guide` | Saving |
| 3 | How to Build a 6-Month Emergency Fund in 2026 | `how-to-build-a-6-month-emergency-fund-in-2026` | Budgeting |
| 4 | How to Stop Overspending (Without Feeling Deprived) | `how-to-stop-overspending-without-feeling-deprived` | Saving |

## Link Map: What Gets Linked Where

### Article 1: Budget That Works
**Internal links to add:**
- Where it mentions "emergency fund" (Step 4 goals section) -- link to Article 3
- Where it mentions "lifestyle creep" / overspending (Common Mistakes section) -- link to Article 4
- Where it mentions saving / savings goals -- link to Article 2
- Where it mentions "Tools vs Spreadsheets" section -- link to Go Safe Spend app (`https://app.gosafespend.com`)

### Article 2: Save Money Fast on Low Income
**Internal links to add:**
- Where it mentions budgeting ("Budgeting on a low income") -- link to Article 1
- Where it mentions "Build an Emergency Fund Fast" (Step 6) -- link to Article 3
- Where it mentions "Stop Overspending at the Source" (Step 7) -- link to Article 4
- Where it mentions tracking income/expenses (final CTA) -- link to Go Safe Spend app
- Where it mentions "Track Net Worth Monthly" (Step 10) -- link to Go Safe Spend app

### Article 3: 6-Month Emergency Fund
**Internal links to add:**
- Where it mentions calculating expenses / budgeting -- link to Article 1
- Where it mentions "low income" savings (Section "What If You're on a Low Income?") -- link to Article 2
- Where it mentions reducing expenses / subscription cuts (Step 6) -- link to Article 4
- Where it mentions tracking progress monthly (Step 10) -- link to Go Safe Spend app

### Article 4: Stop Overspending
**Internal links to add:**
- Where it mentions budgeting / budget with flexibility (Step 7) -- link to Article 1
- Where it mentions emergency fund (Step 7, financial priorities) -- link to Article 3
- Where it mentions saving on a low income (FAQ Q1) -- link to Article 2
- Where it mentions "Tools and Resources" (Step 8) -- link to Go Safe Spend app
- Where it mentions tracking spending / visualization dashboards -- link to Go Safe Spend app

## App Tool Links

Where articles mention budgeting tools, expense tracking, net worth tracking, or similar features, link to `https://app.gosafespend.com` as the recommended tool.

## Implementation Approach

1. Create a temporary edge function (`admin-blog-bulk-update`) that accepts an array of `{ id, content }` objects and updates each article using the service role key
2. Prepare all 4 updated article contents with internal links inserted as markdown: `[link text](/blog/slug)` for internal posts and `[link text](https://app.gosafespend.com)` for app references
3. Deploy, execute the update, verify, then delete the temporary function

## Expected Link Count

- Roughly 4-5 internal cross-links per article
- 1-2 app tool links per article
- Total: approximately 20-25 new internal/app links across all 4 articles

## Technical Details

### Temporary Edge Function: `supabase/functions/admin-blog-bulk-update/index.ts`

- Accepts POST with JSON body `{ updates: [{ id: string, content: string }] }`
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Updates `blog_posts.content` for each provided ID
- Deleted after successful execution

### No Frontend Changes

All changes are content-level database updates. The existing blog editor and markdown renderer already support markdown links.

| File | Change |
|------|--------|
| `supabase/functions/admin-blog-bulk-update/index.ts` | Temporary edge function to batch-update article content (created then deleted) |
| Database: `blog_posts` | Content field updated for all 4 articles with internal cross-links and app links |

