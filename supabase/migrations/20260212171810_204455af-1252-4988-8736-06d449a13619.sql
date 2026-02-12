
-- Add SEO & content strategy columns to blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS focus_keyword text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS og_image text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS faq_schema_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS article_schema_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cta_headline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cta_description text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cta_button_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cta_url text DEFAULT 'https://app.gosafespend.com';
