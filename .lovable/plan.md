

# Blog CMS Advanced Improvements

## Overview

The blog CMS has solid foundations but is missing several important features for a production-ready publishing workflow. This plan addresses the highest-impact gaps: data safety, content validation, autosave, scheduled publishing, image uploads, and editor UX improvements.

## Changes

### 1. Unsaved Changes Protection

Add a "dirty state" tracker to the editor that:
- Warns before navigating away with unsaved changes (browser `beforeunload` event + React Router blocker)
- Shows a visual indicator ("Unsaved changes") next to the Save button

**File:** `src/pages/admin/BlogEditor.tsx`

### 2. Autosave to LocalStorage

Auto-save the current editor state to localStorage every 30 seconds when there are unsaved changes. On page load (for new articles only), check if a recovery draft exists and offer to restore it.

**File:** `src/pages/admin/BlogEditor.tsx`

### 3. Input Validation (Client + Server)

**Client-side (BlogEditor.tsx):**
- Title: required, max 200 chars
- Slug: required, must match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, max 200 chars
- Content: required for publishing (not for draft save)
- Excerpt: max 300 chars
- Meta title: max 60 chars (with warning at 55+)
- Meta description: max 160 chars (with warning at 140+)
- Featured image URL: basic URL format validation
- Show inline validation errors

**Server-side (edge function):**
- Validate title length (max 200)
- Validate slug format and length
- Check slug uniqueness before insert/update (return user-friendly error)
- Sanitize content (strip any script tags)
- Validate excerpt, meta fields lengths

**Files:** `src/pages/admin/BlogEditor.tsx`, `supabase/functions/admin-blog/index.ts`

### 4. Slug Uniqueness Check

Add a real-time slug availability check:
- On slug change (debounced 500ms), query the edge function to check if the slug is already taken (excluding current post ID on edit)
- Show green checkmark or red warning next to the slug field
- Block save/publish if slug is taken

**Files:** `src/pages/admin/BlogEditor.tsx`, `supabase/functions/admin-blog/index.ts` (add a `checkSlug` query param to GET)

### 5. Scheduled Publishing

Add a "Schedule" option alongside "Save Draft" and "Publish":
- New date/time picker for `scheduled_publish_at`
- When set, article saves as draft with a scheduled timestamp
- A badge shows "Scheduled for [date]" on the list page
- Note: Actual auto-publishing requires a cron job or Supabase pg_cron extension, which we'll document but not implement now. For now, admins get a visual reminder and can manually publish when the time comes.

This requires a new column:

```sql
ALTER TABLE blog_posts ADD COLUMN scheduled_publish_at timestamptz DEFAULT NULL;
```

**Files:** `src/pages/admin/BlogEditor.tsx`, `src/pages/admin/BlogPosts.tsx`, `supabase/functions/admin-blog/index.ts`, DB migration

### 6. Image Upload to Supabase Storage

Create a `blog-images` storage bucket and add an upload button next to the featured image URL field:
- Admin can either paste a URL or upload an image file
- Uploaded images go to `blog-images/{post-slug}/{filename}`
- The upload returns a public URL which populates the featured image field
- Support drag-and-drop on the upload area

**Files:** `src/pages/admin/BlogEditor.tsx`, DB migration (create storage bucket + policy)

### 7. Word Count + Editor Stats Bar

Add a stats bar below the content editor showing:
- Word count
- Character count
- Reading time (already calculated)
- Paragraph count

**File:** `src/pages/admin/BlogEditor.tsx`

### 8. Bulk Actions on List Page

Add checkboxes to the blog list table with a bulk action bar (following the existing `BulkActionsBar` pattern):
- Bulk publish
- Bulk unpublish
- Bulk delete (with confirmation)

**Files:** `src/pages/admin/BlogPosts.tsx`, `supabase/functions/admin-blog/index.ts` (add bulk operations to PUT/DELETE)

### 9. Sort Options on List Page

Add sortable column headers:
- Sort by title (A-Z, Z-A)
- Sort by created date (newest, oldest)
- Sort by published date
- Sort by reading time

**Files:** `src/pages/admin/BlogPosts.tsx`, `supabase/functions/admin-blog/index.ts` (add `sortBy` and `sortOrder` query params)

### 10. Admin SELECT RLS Policy

Add an RLS policy so admins can also read all posts (including drafts) directly via Supabase client queries, not just through the service-role edge function:

```sql
CREATE POLICY "Admins can read all posts"
  ON blog_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
```

**File:** DB migration

## Technical Details

### Database Migration

```sql
-- Add scheduled publishing column
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz DEFAULT NULL;

-- Admin can read all posts (including drafts)
CREATE POLICY "Admins can read all posts"
  ON public.blog_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create blog images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for blog images
CREATE POLICY "Admins can upload blog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');
```

### Edge Function Updates (`admin-blog`)

- **GET with `?checkSlug=my-slug&excludeId=uuid`**: Returns `{ available: boolean }`
- **GET with `?sortBy=title&sortOrder=asc`**: Adds sorting to list queries
- **POST/PUT**: Add server-side validation (title length, slug format/uniqueness, content sanitization)
- **PUT with bulk**: Accept `{ ids: string[], updates: {...} }` for bulk operations
- **DELETE with bulk**: Accept `{ ids: string[] }` for bulk delete

### Files Summary

| File | Changes |
|------|---------|
| DB migration | Add `scheduled_publish_at` column, admin SELECT policy, storage bucket + policies |
| `supabase/functions/admin-blog/index.ts` | Validation, slug check, sorting, bulk operations |
| `src/hooks/admin/useAdminBlog.ts` | Add `useSlugCheck` hook, bulk mutation, sort params |
| `src/pages/admin/BlogEditor.tsx` | Validation, unsaved warning, autosave, slug check, image upload, word count bar, scheduled publishing |
| `src/pages/admin/BlogPosts.tsx` | Bulk actions, sortable columns, scheduled badge |

### Implementation Order

1. Database migration (new column, RLS policy, storage bucket)
2. Edge function updates (validation, slug check, sorting, bulk ops)
3. Hook updates (slug check, bulk actions, sort params)
4. Blog editor improvements (validation, autosave, unsaved warning, slug check, image upload, word count, scheduling)
5. Blog list improvements (bulk actions, sorting, scheduled badge)
