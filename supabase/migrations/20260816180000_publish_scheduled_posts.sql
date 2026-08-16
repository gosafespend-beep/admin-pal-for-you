-- ADM-1: make scheduled publishing actually publish.
--
-- The editor writes scheduled_publish_at (BlogEditor.tsx) and the admin list
-- renders a "scheduled" badge (BlogPosts.tsx), but nothing ever acted on it --
-- no pg_cron job, no scheduled function anywhere in either repo -- and the
-- marketing site filters on is_published alone. A post scheduled for next
-- Tuesday would have stayed invisible forever while the UI displayed a date
-- and looked handled.
--
-- Confirmed against production when this was written: 26 posts, 12 published,
-- 14 drafts, 0 scheduled. So scheduling was not what stalled the blog -- the
-- drafts were simply never published -- but the feature was broken and would
-- have silently swallowed the first post anyone did schedule.

CREATE OR REPLACE FUNCTION public.publish_due_blog_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_published integer;
BEGIN
  WITH due AS (
    UPDATE public.blog_posts
       SET is_published = true,
           -- The intended time, not the moment cron happened to run, so
           -- ordering on the blog matches what the author chose.
           published_at  = coalesce(published_at, scheduled_publish_at),
           updated_at    = now()
     WHERE NOT is_published
       AND scheduled_publish_at IS NOT NULL
       AND scheduled_publish_at <= now()
     RETURNING id
  )
  SELECT count(*) INTO v_published FROM due;

  IF v_published > 0 THEN
    RAISE LOG 'publish_due_blog_posts: published % post(s)', v_published;
  END IF;

  RETURN v_published;
END;
$fn$;

REVOKE ALL ON FUNCTION public.publish_due_blog_posts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_blog_posts() TO service_role;

-- Every 15 minutes: close enough that a scheduled time is honoured, cheap
-- enough to ignore.
SELECT cron.unschedule('publish-due-blog-posts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-due-blog-posts');

SELECT cron.schedule(
  'publish-due-blog-posts',
  '*/15 * * * *',
  $job$ SELECT public.publish_due_blog_posts(); $job$
);

-- NOTE: the marketing site's prerender should also treat scheduled_publish_at
-- as a gate, so a post entering the sitemap coincides with going live.
