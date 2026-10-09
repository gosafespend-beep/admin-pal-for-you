-- 02_enforce_admin_mfa.sql
--
-- NOT applied automatically. DO NOT apply until ALL of these are true:
--   1. The new login (MFA code step) and Settings > Two-factor card are live.
--   2. Every admin has enrolled an authenticator app and signed in once with it.
--   3. A break-glass plan exists (a second admin with their own factor, and
--      someone who can run this migration's rollback from the SQL editor).
--
-- Today is_admin() requires AAL2 only if the account already has a verified
-- factor, so an admin with no factor is let in on a password alone, and an
-- attacker who phishes the password can simply never enrol one.
-- This makes AAL2 mandatory: no verified factor, no admin access.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
           select 1 from public.user_roles
           where user_id = auth.uid() and role = 'admin'
         )
     and (auth.jwt() ->> 'aal') = 'aal2'
$$;

commit;

-- Rollback (restores the current behaviour):
--   create or replace function public.is_admin() returns boolean
--   language sql stable security definer set search_path to 'public' as $$
--     select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
--       and ((auth.jwt() ->> 'aal') = 'aal2'
--            or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
--   $$;
