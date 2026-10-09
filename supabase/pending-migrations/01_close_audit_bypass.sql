-- 01_close_audit_bypass.sql
--
-- NOT applied automatically (lives outside supabase/migrations on purpose).
-- Apply AFTER the new edge functions are deployed, because the old functions
-- and any other client that writes these tables directly would stop working.
--
-- Problem: an admin's browser session could write user_roles, admin_user_notes
-- and admin_audit_log straight through PostgREST (the policies allow it),
-- bypassing the edge functions and therefore their audit trail and their rules
-- (no last-admin protection, forged admin_id on notes, forged audit rows).
--
-- After this migration:
--   * admins can still READ all three tables (policies kept);
--   * all writes go through the edge functions (service role);
--   * audit rows cannot be changed or removed, by anyone but a superuser;
--   * any change to user_roles is audited by the database itself, even when it
--     is made from the SQL editor or a script.
--
-- blog_posts policies are intentionally untouched: another project
-- ("Supabase Admin Pal") may write them directly.

begin;

-- 1. Remove direct write paths for admins ------------------------------------
drop policy if exists "Admins can insert roles"   on public.user_roles;
drop policy if exists "Admins can update roles"   on public.user_roles;
drop policy if exists "Admins can delete roles"   on public.user_roles;

drop policy if exists "Admins can insert notes"   on public.admin_user_notes;
drop policy if exists "Admins can update notes"   on public.admin_user_notes;
drop policy if exists "Admins can delete notes"   on public.admin_user_notes;

drop policy if exists "Admins can insert audit log" on public.admin_audit_log;

revoke insert, update, delete on public.user_roles       from authenticated, anon;
revoke insert, update, delete on public.admin_user_notes from authenticated, anon;
revoke insert, update, delete, truncate on public.admin_audit_log from authenticated, anon;

-- 2. Audit log is append-only ------------------------------------------------
create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_log is append-only (% blocked)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists admin_audit_log_no_update on public.admin_audit_log;
create trigger admin_audit_log_no_update
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();

drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_append_only();

-- 3. Database-level audit of role changes ------------------------------------
-- admin_user_id is NOT NULL, so when there is no signed-in user (SQL editor,
-- migrations, service-role scripts) the all-zero uuid is recorded and the
-- Postgres role is kept in details.
create or replace function public.audit_user_roles_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  affected public.user_roles;
begin
  affected := case when tg_op = 'DELETE' then old else new end;
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  values (
    actor,
    'db_user_roles_' || lower(tg_op),
    'user_role',
    affected.user_id::text,
    jsonb_build_object('role', affected.role, 'db_role', current_user, 'via', 'trigger')
  );
  return affected;
end;
$$;

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_user_roles_change();

commit;

-- Rollback (re-opens the bypass):
--   drop trigger user_roles_audit on public.user_roles;
--   drop function public.audit_user_roles_change();
--   drop trigger admin_audit_log_no_update on public.admin_audit_log;
--   drop trigger admin_audit_log_no_truncate on public.admin_audit_log;
--   drop function public.admin_audit_log_append_only();
--   -- then recreate the seven policies and grants from supabase/migrations.
