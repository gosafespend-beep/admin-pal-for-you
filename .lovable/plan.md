

# Fix Branding: "Go Safe Spend" to "Safe Spend"

## Problem
The app is incorrectly referred to as "Go Safe Spend" throughout the codebase and all 26 blog articles in the database. The correct branding is **Safe Spend**. The domain `https://app.gosafespend.com` is correct and does not change.

## Changes

### 1. Frontend Code Updates (3 files)

| File | What changes |
|------|-------------|
| `src/components/admin/sidebar/SidebarBranding.tsx` | Change alt text and display name from "Go Safe Spend" to "Safe Spend" |
| `src/pages/admin/AdminLogin.tsx` | Change alt text and heading from "Go Safe Spend" to "Safe Spend" |
| `src/index.css` | Update comment from "Go Safe Spend" to "Safe Spend" |

### 2. Database Content Update (26 blog articles)

All 26 articles in the `blog_posts` table contain "Go Safe Spend" in their markdown content. A temporary edge function will perform a bulk find-and-replace:

- Replace all instances of `Go Safe Spend` with `Safe Spend` in the `content` field
- Domain references like `app.gosafespend.com` and `gosafespend.com` remain unchanged

**Approach:**
1. Create temporary edge function `admin-blog-insert` (reusing the established pattern)
2. Run a single SQL-style update: replace "Go Safe Spend" with "Safe Spend" in content for all 26 posts
3. Verify the update, then delete the temporary function

### Summary

- **3 source files** edited (simple text replacements)
- **26 database rows** updated via temporary edge function
- No domain or URL changes -- only the brand name text

