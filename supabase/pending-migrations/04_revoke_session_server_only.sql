-- 04_revoke_session_server_only.sql
--
-- NOT applied automatically. Apply AFTER the new frontend (session revoke goes
-- through admin-user-actions) and the Phase 1 edge functions are live.
--
-- Until now the admin panel called public.revoke_user_session straight from the
-- browser, which skipped the audit trail. It now goes through
-- admin-user-actions (action "revoke_session"), so the browser no longer needs
-- EXECUTE. The user-facing revoke-session edge function uses the service role
-- and is unaffected.

revoke execute on function public.revoke_user_session(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.revoke_user_session(uuid, uuid) to service_role;

-- Rollback:
--   grant execute on function public.revoke_user_session(uuid, uuid) to authenticated;
