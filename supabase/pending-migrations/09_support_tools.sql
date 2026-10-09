-- 09_support_tools.sql
--
-- NOT applied automatically. Additive; safe to apply before the matching edge
-- function and frontend are deployed (nothing uses it yet).
--
-- Support tools:
--   * support_macros: saved replies an admin can fill in and send from their own
--     email. Placeholders look like {{first_name}}; the edge function validates
--     them on save so a typo never reaches a customer.
--   * admin_support_snapshot(user): the facts behind "why can't they save?"
--     (is write enforcement on, does the app treat them as premium, do they
--     have a grace period), taken from the same public.can_write() the app uses
--     so the answer cannot drift from what the app really does.
--
-- Design notes
--  * support_macros has no user_id column, so delete_user_data never touches it.
--  * The starter replies are drafts: edit the wording on the Support page.

-- 1. Saved replies --------------------------------------------------------------
create table if not exists public.support_macros (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 3 and 80),
  category    text not null default 'other' check (category in ('account', 'billing', 'privacy', 'how_to', 'other')),
  subject     text not null check (length(subject) between 3 and 150),
  body        text not null check (length(body) between 10 and 4000),
  active      boolean not null default true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists support_macros_active_idx on public.support_macros (category, title) where active;

alter table public.support_macros enable row level security;
revoke all on public.support_macros from anon, authenticated;
grant select, insert, update, delete on public.support_macros to service_role;

insert into public.support_macros (title, category, subject, body)
select * from (values
  ('Confirm your email to sign in', 'account', 'Confirm your email to sign in to SafeSpend',
   E'Hi {{first_name}},\n\nThanks for reaching out. Your account ({{email}}) is waiting for its email to be confirmed, and until that is done you will not be able to sign in.\n\nWe have sent a fresh confirmation email. Please open it and follow the link; it can take a few minutes to arrive, so check your spam folder too.\n\nIf it still does not arrive, reply to this message and we will help from here.\n\nSafeSpend Support'),
  ('Password reset help', 'account', 'Resetting your SafeSpend password',
   E'Hi {{first_name}},\n\nSorry you are locked out. You can reset your password from the sign-in screen by choosing the forgotten-password option and entering {{email}}. A reset link will be emailed to you.\n\nFor your security we cannot see or change your password for you. If the email does not arrive within a few minutes, check spam and reply here so we can look into it.\n\nSafeSpend Support'),
  ('Trial ended: what happens next', 'billing', 'About your SafeSpend trial',
   E'Hi {{first_name}},\n\nYour free trial ended on {{trial_end}}. Your data is safe and still yours; subscribing keeps everything working as before.\n\nIf you have questions about plans or pricing, just reply and we will help.\n\nSafeSpend Support'),
  ('Subscription cancelled', 'billing', 'Your SafeSpend subscription has been cancelled',
   E'Hi {{first_name}},\n\nWe have cancelled your subscription as you asked. You will keep access until {{period_end}}, and you will not be charged again.\n\nIf you change your mind you can resubscribe at any time. Is there anything we could have done better? We read every reply.\n\nSafeSpend Support'),
  ('Request about your data received', 'privacy', 'We received your data request',
   E'Hi {{first_name}},\n\nWe have received your request about your data. Before we act on it we need to confirm that it really comes from you, so please reply from {{email}} (the address on your account) and tell us exactly what you would like us to do.\n\nWe will confirm each step by email.\n\nSafeSpend Support'),
  ('Getting started: log your first transaction', 'how_to', 'Getting the most out of SafeSpend',
   E'Hi {{first_name}},\n\nThanks for joining SafeSpend on {{signup_date}}. The quickest way to see it work is to add your first expense or income, even a small one. Once you have a few entries, your budgets and reports start to fill in.\n\nIf anything is confusing, reply to this message and tell us where you got stuck.\n\nSafeSpend Support'),
  ('Need more details about a problem', 'other', 'Help us look into the problem you reported',
   E'Hi {{first_name}},\n\nThanks for letting us know, and sorry for the trouble. To investigate we need a few details:\n\n1. What you were trying to do\n2. What happened instead (a screenshot helps)\n3. Whether it was on Android, iPhone or the website\n\nReply with whatever you can and we will take it from there.\n\nSafeSpend Support')
) as seed(title, category, subject, body)
where not exists (select 1 from public.support_macros);

-- 2. Why can't they save? --------------------------------------------------------
create or replace function public.admin_support_snapshot(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select jsonb_build_object(
    'enforcementOn', coalesce((select value::text::boolean from public.app_settings where key = 'enforce_write_entitlement'), false),
    'isPremium',     public.user_is_premium(p_user),
    'graceUntil',    (select write_access_until from public.profiles where user_id = p_user),
    'canWrite',      public.can_write(p_user))
$fn$;

revoke all on function public.admin_support_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.admin_support_snapshot(uuid) to service_role;

-- Rollback:
--   drop function public.admin_support_snapshot(uuid);
--   drop table public.support_macros;
