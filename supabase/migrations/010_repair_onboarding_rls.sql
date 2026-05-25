-- 010_repair_onboarding_rls.sql
-- Repair the RLS policies that gate onboarding: practices INSERT and
-- practice_users INSERT for the very first member (the new owner).
-- The automated admin-flow test caught a "new row violates row-level security
-- policy for table 'practices'" error, which means either 006 didn't fully
-- apply, or a later change drifted the policy. This migration drops every
-- existing policy on the two tables by name and re-creates exactly the set
-- we want.

-- ── practices ────────────────────────────────────────────────────────────────
alter table practices enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='practices' loop
    execute format('drop policy if exists %I on public.practices', p.policyname);
  end loop;
end $$;

-- Any practice member can read their practice
create policy practices_member_read on practices for select
  using (user_is_practice_member(id));

-- Any authenticated user can insert a practice (becomes the owner via the
-- practice_users insert that immediately follows in /api/onboarding/finalize)
create policy practices_authenticated_create on practices for insert
  to authenticated
  with check (auth.uid() is not null);

-- Practice admins can update / delete their practice
create policy practices_admin_modify on practices for update
  to authenticated
  using      (user_is_practice_admin(id))
  with check (user_is_practice_admin(id));

create policy practices_admin_delete on practices for delete
  to authenticated
  using (user_is_practice_admin(id));

-- ── practice_users ───────────────────────────────────────────────────────────
alter table practice_users enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='practice_users' loop
    execute format('drop policy if exists %I on public.practice_users', p.policyname);
  end loop;
end $$;

-- Members can see who else is in their practice (uses SECURITY DEFINER helper to dodge recursion)
create policy practice_users_member_read on practice_users for select
  using (user_is_practice_member(practice_id));

-- Owner-bootstrap: a user can insert THEIR OWN owner row on a brand-new practice.
-- We can't check "is this person the owner of the practice" because they're
-- becoming the owner right now. We just require the row is for the caller.
create policy practice_users_self_bootstrap on practice_users for insert
  to authenticated
  with check (user_id = auth.uid());

-- Admins can add / change / remove other members
create policy practice_users_admin_manage on practice_users for all
  to authenticated
  using      (user_is_practice_admin(practice_id))
  with check (user_is_practice_admin(practice_id));
