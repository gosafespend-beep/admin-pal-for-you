# Reliable blog image fallback

## Goal
Provide one centrally managed default blog image that is shown whenever an article has no featured image or its assigned image fails to load.

## Implementation
1. **Store and expose the setting**
   - Use the existing `app_settings` table with a `blog_default_featured_image` key containing the selected public image URL.
   - Add a narrowly scoped public read function that returns only this blog display setting, without exposing other application settings.
   - Keep writes behind the existing server-verified admin settings function and record every change in the admin audit log.

2. **Add the admin control**
   - Add a Blog Defaults section to Settings with an image upload/select control, URL validation, preview, save state, and clear error feedback.
   - Upload chosen files to the existing `blog-images` storage bucket and save the resulting public asset URL.
   - Show the currently active default image before an administrator changes it.

3. **Use the fallback consistently in this app**
   - Add a small reusable blog image component that tries the article image first, switches once to the configured default on failure, and then shows a stable non-image placeholder if both fail.
   - Use it in the blog editor preview so missing and broken article images behave exactly like the live-site contract.
   - Treat an empty featured-image field as an intentional use of the default, while preserving per-article overrides.

4. **Define the customer-site integration contract**
   - The public Safe Spend site reads the narrowly scoped setting and applies the same two-stage image fallback (`featured_image` → configured default).
   - This admin project will expose the safe data contract; the separate customer-site project must apply its own image `onError` behavior to cover remote files that later become unavailable.

## Verification
- Confirm an administrator can upload and save a default image, reload Settings, and see it retained.
- Confirm editor previews fall back for an empty URL, an invalid/broken URL, and recover when a valid URL is entered.
- Confirm only administrators can change the setting, anonymous users can read only the blog fallback value, and the update appears in Audit Log.
- Run the focused typecheck and verify Settings and Blog Editor at desktop and mobile widths.

## Technical details
- No new table is needed; this uses the existing key/value settings store.
- The public read function returns one allow-listed value rather than granting anonymous access to `app_settings`.
- Existing per-post `featured_image` and `og_image` values remain unchanged.
