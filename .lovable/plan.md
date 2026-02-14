

# Fix Blog Editor Save/Publish Failures

## Problem

When clicking "Save Draft" or "Publish" in the blog editor, the request fails silently. The root cause is a **missing CORS header** in the edge function.

The `admin-blog` edge function's CORS configuration does not include the `Access-Control-Allow-Methods` header. Without it, browsers only allow "simple" HTTP methods (GET, HEAD, POST) through CORS. Since the blog editor uses **PUT** for updates and **DELETE** for deletions, the browser blocks these requests during the preflight check.

This also means that the existing blog post (which was seeded via database migration) cannot be updated through the UI.

## Solution

### 1. Fix CORS headers in the edge function

Add `Access-Control-Allow-Methods` to the `corsHeaders` object in `supabase/functions/admin-blog/index.ts` to explicitly allow all required HTTP methods.

### 2. Improve error handling in the hook

The current error handling in `useAdminBlog.ts` uses `response.error.message`, which for Supabase SDK errors returns a generic string like "Edge Function returned a non-2xx status code" instead of the actual error from the server. Update the mutation error handling to extract the real error message from the response body.

## Technical Details

### Edge Function Change (`supabase/functions/admin-blog/index.ts`)

Update the `corsHeaders` object to include the methods header:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
}
```

### Hook Error Handling (`src/hooks/admin/useAdminBlog.ts`)

Update mutations to try reading the actual error from the response context before falling back to the generic message:

```typescript
if (response.error) {
  // Try to extract the actual error message from the response
  let message = response.error.message;
  try {
    if (response.error.context) {
      const body = await response.error.context.json();
      if (body?.error) message = body.error;
    }
  } catch {}
  throw new Error(message);
}
```

### Audit Other Edge Functions

All other `admin-*` edge functions likely have the same missing `Access-Control-Allow-Methods` header. They should be checked and updated for consistency, though this may not cause issues if they only use POST/GET.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-blog/index.ts` | Add `Access-Control-Allow-Methods` to CORS headers |
| `src/hooks/admin/useAdminBlog.ts` | Improve error message extraction in mutations |

