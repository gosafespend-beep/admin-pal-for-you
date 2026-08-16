# Database schema

This repository holds no migrations. There is one database, and it is owned by
the web app repo:

    https://github.com/smartvideofy/gosafespend  ->  supabase/

Migrations used to be split across four repositories, none of which held enough
to rebuild the schema. See `supabase/SCHEMA_OWNERSHIP.md` there for what was
consolidated and why, including two defects the split was hiding.

Schema changes for this project go in that repo, not this one. That includes the
blog scheduler (`publish_due_blog_posts()` and its pg_cron entry), which was
written here and now lives there.

`config.toml` and the twelve `admin-*` edge functions stay: those are this
panel's own and are deployed from here. It is only the *schema* that moved.
