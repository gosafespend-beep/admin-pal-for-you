

# Blog CMS for Admin Panel

## Backend Status: Already Done

The landing site has already created the `blog_posts` table with all necessary columns:
- `title`, `slug`, `content`, `excerpt`, `featured_image`
- `author_name`, `category`, `tags` (text array)
- `is_published`, `published_at`, `reading_time_minutes`
- `meta_title`, `meta_description` (SEO overrides)
- `created_at`, `updated_at`

RLS policies are also in place:
- Public can read published posts (`is_published = true`)
- Admins can INSERT, UPDATE, DELETE via `has_role(auth.uid(), 'admin')`

No database migration needed. We just build the admin UI.

## What We'll Build

### 1. Blog Posts List Page (`/blog`)
A management table (following the Waitlist/Users pattern) showing:
- All posts (drafts and published)
- Columns: Title, Category, Status badge (Draft/Published), Published Date, Reading Time
- Search by title, filter by status and category
- Quick actions: Edit, Publish/Unpublish, Delete (with confirmation)
- "New Article" button
- Pagination, CSV export

### 2. Blog Editor Page (`/blog/new` and `/blog/editor/:id`)
A full article editor form with:
- Title input (auto-generates slug)
- Slug input (editable)
- Large Markdown content textarea with live preview toggle
- Excerpt textarea with character counter (target 150-160 chars)
- Category dropdown (Budgeting, Saving, Investing, Debt, Tools, News)
- Tags input (comma-separated)
- Featured image URL with preview
- Collapsible SEO section: meta_title, meta_description overrides
- Author name (defaults to "Safe Spend Team")
- Auto-calculated reading time (editable)
- "Save Draft" and "Publish" buttons

### 3. Edge Function: `admin-blog`
CRUD operations with admin auth validation:
- **GET**: List all posts with pagination, search, status/category filters
- **POST**: Create new post (auto-generate slug if empty, calculate reading time)
- **PUT**: Update post (set `published_at` when publishing)
- **DELETE**: Delete post

### 4. Navigation and Routing Updates
- Add "Blog" to sidebar (FileText icon, under Main Menu)
- Add "Blog" to command search
- Add routes: `/blog`, `/blog/new`, `/blog/editor/:id`

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/admin-blog/index.ts` | Blog CRUD edge function |
| `src/hooks/admin/useAdminBlog.ts` | Hook for blog data and mutations |
| `src/pages/admin/BlogPosts.tsx` | Blog posts list page |
| `src/pages/admin/BlogEditor.tsx` | Article create/edit page |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add 3 routes: `blog`, `blog/new`, `blog/editor/:id` |
| `src/components/admin/AdminSidebar.tsx` | Add Blog nav item with FileText icon |
| `src/components/admin/AdminSearch.tsx` | Add Blog to searchable pages |
| `supabase/config.toml` | Register `admin-blog` with `verify_jwt = false` |

### New Dependency

- `react-markdown` + `remark-gfm` for Markdown preview in the editor

### Implementation Order

1. Edge function (`admin-blog`) -- CRUD with admin auth
2. Hook (`useAdminBlog`) -- query + mutations
3. Blog list page (`BlogPosts.tsx`) -- table with filters
4. Blog editor page (`BlogEditor.tsx`) -- form with Markdown preview
5. Sidebar, search, routing updates
