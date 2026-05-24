-- 008_user_profiles.sql
-- Stores per-user profile data and the admin-vs-employee account type chosen
-- during sign-up. Employees fill a minimal verification form and then wait
-- for an admin to add them via /app/team.

create table if not exists user_profiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  account_type          text not null default 'admin' check (account_type in ('admin','employee')),
  full_name             text,
  job_title             text,
  phone                 text,
  primary_address       jsonb,
  pending_practice_name text,
  onboarded_at          timestamptz,
  updated_at            timestamptz default now()
);

create or replace function touch_user_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists user_profiles_touch on user_profiles;
create trigger user_profiles_touch before update on user_profiles
  for each row execute function touch_user_profiles_updated_at();

alter table user_profiles enable row level security;

drop policy if exists user_profiles_self on user_profiles;
create policy user_profiles_self on user_profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_profiles_admin_read on user_profiles;
create policy user_profiles_admin_read on user_profiles
  for select
  using (
    exists (
      select 1 from public.practice_users pu
      where pu.user_id = user_profiles.user_id
        and user_is_practice_admin(pu.practice_id)
    )
  );

grant all on user_profiles to service_role;
