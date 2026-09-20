CREATE OR REPLACE FUNCTION public.get_public_blog_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'default_featured_image', COALESCE(
      (
        SELECT CASE
          WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
          ELSE NULL
        END
        FROM public.app_settings
        WHERE key = 'blog_default_featured_image'
        LIMIT 1
      ),
      ''
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_blog_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_blog_settings() TO anon, authenticated, service_role;