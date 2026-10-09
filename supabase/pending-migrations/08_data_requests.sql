-- 08_data_requests.sql
--
-- NOT applied automatically. Additive; safe to apply before the matching edge
-- function and frontend are deployed (nothing uses it yet).
--
-- A queue for people asking what we hold on them: get a copy, delete it, fix
-- it, or stop marketing emails. Each request has a due date so none is
-- forgotten, and every step is written to the admin audit log by the edge
-- function.
--
-- Design notes
--  * The table deliberately has NO column named user_id. public.delete_user_data
--    discovers every public table with a user_id column and deletes from it, so
--    a user_id here would erase the record of the request when the account is
--    deleted - which is exactly when you need that record.
--  * subject_user_id is not a foreign key for the same reason: the request
--    must outlive the account.
--  * The export and the retention report use the same discovery as
--    delete_user_data (every public table with a user_id column), so what we
--    would delete and what we would hand over cannot drift apart.

-- 1. The queue -----------------------------------------------------------------
create table if not exists public.data_requests (
  id                    uuid primary key default gen_random_uuid(),
  request_type          text not null check (request_type in ('export', 'delete', 'rectify', 'opt_out', 'other')),
  status                text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  requester_email       text not null check (length(requester_email) between 3 and 320),
  subject_user_id       uuid,
  channel               text not null default 'email' check (channel in ('email', 'in_app', 'other')),
  received_at           timestamptz not null default now(),
  due_at                timestamptz not null,
  identity_verified_at  timestamptz,
  verification_note     text,
  verified_by           uuid,
  export_generated_at   timestamptz,
  completed_at          timestamptz,
  resolution            text,
  created_by            uuid not null,
  handled_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists data_requests_open_idx on public.data_requests (due_at) where status in ('received', 'in_progress');
create index if not exists data_requests_subject_idx on public.data_requests (subject_user_id);

alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon, authenticated;

-- 2. Find an account by email (service role only) -------------------------------
create or replace function public.admin_find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select id from auth.users
  where lower(email) = lower(trim(p_email)) and deleted_at is null
  limit 1
$fn$;

-- 3. Everything we hold on one person, as JSON ----------------------------------
-- Same table discovery as delete_user_data. Provider secrets are removed, and
-- internal admin notes are reported as a count rather than included, so a
-- person can review them before deciding what to release.
create or replace function public.admin_export_user_data(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $fn$
declare
  r record;
  rows jsonb;
  n bigint;
  tables jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
  acct jsonb;
  notes bigint := 0;
begin
  if p_user is null then raise exception 'p_user is required'; end if;

  select jsonb_build_object(
           'email', u.email, 'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
           'emailConfirmedAt', u.email_confirmed_at, 'bannedUntil', u.banned_until,
           'signInMethods', coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id), '[]'::jsonb))
    into acct
  from auth.users u where u.id = p_user;

  for r in
    select cl.relname::text as tbl
    from pg_attribute a
    join pg_class cl on cl.oid = a.attrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relkind in ('r', 'p')
      and a.attname = 'user_id' and a.attnum > 0 and not a.attisdropped
    order by 1
  loop
    if r.tbl = 'admin_user_notes' then
      execute 'select count(*) from public.admin_user_notes where user_id = $1' into notes using p_user;
      continue;
    end if;
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) - ''paystack_email_token''), ''[]''::jsonb), count(*) from public.%I t where t.user_id = $1',
      r.tbl) into rows, n using p_user;
    if n > 0 then
      tables := tables || jsonb_build_object(r.tbl, rows);
      counts := counts || jsonb_build_object(r.tbl, n);
    end if;
  end loop;

  return jsonb_build_object(
    'generatedAt', now(),
    'account', acct,
    'counts', counts,
    'data', tables,
    'alsoHeld', jsonb_build_object('internalAdminNotes', notes));
end
$fn$;

-- 4. What we hold, in aggregate (no personal data) -----------------------------
create or replace function public.admin_retention_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $fn$
declare
  r record;
  n bigint;
  oldest timestamptz;
  out jsonb := '[]'::jsonb;
  has_created boolean;
begin
  for r in
    select distinct cl.relname::text as tbl
    from pg_attribute a
    join pg_class cl on cl.oid = a.attrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
      and (a.attname = 'user_id'
           or cl.relname in ('waitlist', 'ebook_leads', 'ebook_events', 'admin_audit_log', 'rate_limit_hits', 'data_requests'))
      and cl.relname not like 'sgs\_%'
    order by 1
  loop
    select exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = 'created_at')
      into has_created;
    if has_created then
      execute format('select count(*), min(created_at) from public.%I', r.tbl) into n, oldest;
    else
      execute format('select count(*) from public.%I', r.tbl) into n;
      oldest := null;
    end if;
    out := out || jsonb_build_object('table', r.tbl, 'rows', n, 'oldest', oldest);
  end loop;
  return out;
end
$fn$;

-- 5. Marketing consent summary ---------------------------------------------------
create or replace function public.admin_consent_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select jsonb_build_object(
    'accounts',          (select count(*) from auth.users where deleted_at is null),
    'marketingOn',       (select count(*) from public.notification_preferences where marketing_emails),
    'marketingOff',      (select count(*) from public.notification_preferences where not marketing_emails),
    'noPreferenceSaved', (select count(*) from auth.users u where u.deleted_at is null
                          and not exists (select 1 from public.notification_preferences p where p.user_id = u.id)),
    'ebookLeads',        (select count(*) from public.ebook_leads),
    'waitlist',          (select count(*) from public.waitlist))
$fn$;

revoke all on function public.admin_find_user_by_email(text) from public, anon, authenticated;
revoke all on function public.admin_export_user_data(uuid) from public, anon, authenticated;
revoke all on function public.admin_retention_report() from public, anon, authenticated;
revoke all on function public.admin_consent_summary() from public, anon, authenticated;
grant execute on function public.admin_find_user_by_email(text) to service_role;
grant execute on function public.admin_export_user_data(uuid) to service_role;
grant execute on function public.admin_retention_report() to service_role;
grant execute on function public.admin_consent_summary() to service_role;
grant select, insert, update on public.data_requests to service_role;

-- Rollback:
--   drop function public.admin_find_user_by_email(text);
--   drop function public.admin_export_user_data(uuid);
--   drop function public.admin_retention_report();
--   drop function public.admin_consent_summary();
--   drop table public.data_requests;
