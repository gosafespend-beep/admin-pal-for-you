CREATE OR REPLACE FUNCTION public.get_public_blog_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
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

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE POLICY "Public can read blog image fallback"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'blog_default_featured_image');