-- 15_marketing_controls.sql
--
-- NOT applied automatically. Additive; nothing changes until someone presses a
-- button on the Marketing page.
--
-- Pause and resume for the automated marketing system, built only on the two
-- switches the system already honours:
--   * agent: sgs_agents_rt.status = 'paused'. agent-run refuses a paused agent
--     (HTTP 409), so it writes nothing and spends nothing.
--   * channel: sgs_channels.enabled = false. publish-direct posts only to
--     enabled channels.
--
-- Every pause is recorded with what it replaced, so "resume" puts things back
-- exactly as they were (a 'shadow' agent returns to 'shadow', not 'active'),
-- and so a pause cannot be forgotten: the open rows are listed on the page and
-- the monitor warns when one has lasted two weeks.
--
-- Known effect, shown to the person before they confirm: a post already
-- scheduled for a channel that is switched off is marked failed by
-- social-release when its time comes.
--
-- marketing_pauses has no user_id column, so delete_user_data never touches it.
-- All functions are service role only; the edge function checks is_admin() and
-- writes the audit entry first.

create table if not exists public.marketing_pauses (
  id             uuid primary key default gen_random_uuid(),
  scope          text not null check (scope in ('agent', 'channel')),
  target         text not null check (length(target) between 1 and 60),
  previous_state text not null,
  batch          text,
  reason         text not null check (length(reason) between 5 and 300),
  paused_by      uuid not null,
  paused_at      timestamptz not null default now(),
  resumed_at     timestamptz,
  resumed_by     uuid,
  resume_reason  text
);

-- One open pause per thing; a second attempt is refused instead of recording a wrong "previous" state.
create unique index if not exists marketing_pauses_open_uidx on public.marketing_pauses (scope, target) where resumed_at is null;

alter table public.marketing_pauses enable row level security;
revoke all on public.marketing_pauses from anon, authenticated;
grant select, insert, update on public.marketing_pauses to service_role;

create or replace function public.admin_marketing_pause(p_scope text, p_target text, p_admin uuid, p_reason text, p_batch text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prev text;
begin
  if p_scope = 'agent' then
    select status into v_prev from public.sgs_agents_rt where id = p_target for update;
    if not found then raise exception 'not_found: no agent %', p_target; end if;
    if v_prev = 'paused' then raise exception 'already: agent % is already paused', p_target; end if;
    if v_prev = 'deprecated' then raise exception 'deprecated: agent % is retired', p_target; end if;
    insert into public.marketing_pauses (scope, target, previous_state, batch, reason, paused_by)
      values ('agent', p_target, v_prev, p_batch, p_reason, p_admin);
    update public.sgs_agents_rt set status = 'paused', updated_at = now() where id = p_target;

  elsif p_scope = 'channel' then
    perform 1 from public.sgs_channels where platform = p_target for update;
    if not found then raise exception 'not_found: no channel %', p_target; end if;
    if not exists (select 1 from public.sgs_channels where platform = p_target and enabled) then
      raise exception 'already: channel % is already off', p_target;
    end if;
    v_prev := 'enabled';
    insert into public.marketing_pauses (scope, target, previous_state, batch, reason, paused_by)
      values ('channel', p_target, v_prev, p_batch, p_reason, p_admin);
    update public.sgs_channels set enabled = false where platform = p_target and enabled;

  else
    raise exception 'bad_scope: %', p_scope;
  end if;

  return jsonb_build_object('scope', p_scope, 'target', p_target, 'previous', v_prev);
end
$fn$;

create or replace function public.admin_marketing_resume(p_scope text, p_target text, p_admin uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.marketing_pauses;
  v_restored text;
begin
  select * into v_row from public.marketing_pauses
   where scope = p_scope and target = p_target and resumed_at is null for update;
  if not found then raise exception 'not_found: % % is not paused from this page', p_scope, p_target; end if;

  if p_scope = 'agent' then
    -- Put back what it was, but never overwrite a status someone changed by hand since.
    if (select status from public.sgs_agents_rt where id = p_target) = 'paused' then
      v_restored := case when v_row.previous_state in ('shadow', 'supervised', 'active') then v_row.previous_state else 'active' end;
      update public.sgs_agents_rt set status = v_restored, updated_at = now() where id = p_target;
    else
      v_restored := (select status from public.sgs_agents_rt where id = p_target);
    end if;
  else
    update public.sgs_channels set enabled = true where platform = p_target;
    v_restored := 'enabled';
  end if;

  update public.marketing_pauses
     set resumed_at = now(), resumed_by = p_admin, resume_reason = p_reason
   where id = v_row.id;
  return jsonb_build_object('scope', p_scope, 'target', p_target, 'restored', v_restored);
end
$fn$;

-- Pause everything: every agent that is running and every channel that is on.
create or replace function public.admin_marketing_pause_all(p_admin uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_batch text := gen_random_uuid()::text;
  r record;
  n_agents int := 0;
  n_channels int := 0;
begin
  for r in select id from public.sgs_agents_rt where status in ('shadow', 'supervised', 'active') order by id loop
    perform public.admin_marketing_pause('agent', r.id, p_admin, p_reason, v_batch);
    n_agents := n_agents + 1;
  end loop;
  for r in select distinct platform from public.sgs_channels where enabled order by platform loop
    perform public.admin_marketing_pause('channel', r.platform, p_admin, p_reason, v_batch);
    n_channels := n_channels + 1;
  end loop;
  return jsonb_build_object('agents', n_agents, 'channels', n_channels);
end
$fn$;

-- Resume what "pause everything" paused. Things paused one at a time stay paused.
create or replace function public.admin_marketing_resume_all(p_admin uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  n int := 0;
begin
  for r in select scope, target from public.marketing_pauses where resumed_at is null and batch is not null order by scope, target loop
    perform public.admin_marketing_resume(r.scope, r.target, p_admin, p_reason);
    n := n + 1;
  end loop;
  return jsonb_build_object('resumed', n);
end
$fn$;

revoke all on function public.admin_marketing_pause(text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_marketing_resume(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_marketing_pause_all(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_marketing_resume_all(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_marketing_pause(text, text, uuid, text, text) to service_role;
grant execute on function public.admin_marketing_resume(text, text, uuid, text) to service_role;
grant execute on function public.admin_marketing_pause_all(uuid, text) to service_role;
grant execute on function public.admin_marketing_resume_all(uuid, text) to service_role;

-- Rollback (resume everything first, from the page):
--   drop function public.admin_marketing_resume_all(uuid, text);
--   drop function public.admin_marketing_pause_all(uuid, text);
--   drop function public.admin_marketing_resume(text, text, uuid, text);
--   drop function public.admin_marketing_pause(text, text, uuid, text, text);
--   drop table public.marketing_pauses;
