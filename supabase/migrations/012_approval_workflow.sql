-- 012_approval_workflow.sql
-- Standard-user approval workflow + in-app notifications.
--
-- A Standard user signs up, fills the verification form, and lands in a
-- 'pending' state. An admin of the practice they claim to work at sees
-- them in the approval queue and either approves (creates the
-- practice_users membership) or denies (status='denied', user is bounced
-- to /denied).
--
-- We extend user_profiles in-place instead of adding a separate request
-- table because user_profiles is already the source of truth for
-- standard-user metadata. Administrators do not get a user_profiles row,
-- so the status column only applies to standards.

alter table user_profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending','approved','denied')),
  add column if not exists claimed_admin_name text,
  add column if not exists matched_practice_id uuid references practices(id) on delete set null,
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists denial_reason text;

create index if not exists idx_user_profiles_status
  on user_profiles (status) where status = 'pending';
create index if not exists idx_user_profiles_matched_practice
  on user_profiles (matched_practice_id);

-- ── notifications ───────────────────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  practice_id uuid references practices(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists idx_notifications_user_unread
  on notifications (user_id, created_at desc) where read_at is null;
create index if not exists idx_notifications_user_all
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists notifications_self_read on notifications;
create policy notifications_self_read on notifications for select
  using (user_id = (select auth.uid()));

drop policy if exists notifications_self_update on notifications;
create policy notifications_self_update on notifications for update
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on notifications to authenticated;
grant all on notifications to service_role;
