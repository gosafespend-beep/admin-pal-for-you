

# Add Internal Links to Blog Editor

## Overview

Add a toolbar feature to the markdown editor that lets you search for and insert links to other blog articles directly. Instead of manually typing markdown links, you'll get a searchable dropdown of existing posts and insert them with one click.

## How It Works

1. A new "Insert Link" button appears above the content textarea
2. Clicking it opens a popover with a search field
3. As you type, it searches your existing blog posts by title
4. Clicking a result inserts a markdown link at the cursor position: `[Article Title](/blog/article-slug)`
5. You can also insert a custom URL link with custom text

## Technical Details

### File: `src/pages/admin/BlogEditor.tsx`

- Add a markdown toolbar row above the textarea with an "Insert Link" button (using the existing `Link2` icon already imported)
- The button opens a Popover containing:
  - A search input to filter existing blog posts
  - A scrollable list of matching posts (fetched from the existing `useAdminBlogList` hook)
  - A "Custom URL" tab for external links with text + URL fields
- On selection, insert `[title](/blog/slug)` at the current cursor position in the textarea
- Use a ref on the textarea to track cursor position (`selectionStart`/`selectionEnd`)

### No Backend Changes Needed

The existing `useAdminBlogList` hook already supports search filtering -- it will be reused with a debounced search term to fetch matching posts.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/BlogEditor.tsx` | Add link insertion toolbar with internal post search popover above the content textarea |

