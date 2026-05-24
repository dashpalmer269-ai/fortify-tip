-- ─────────────────────────────────────────────────────────────────────────────
-- 006_fix_rls_recursion.sql
--
-- BLOCKER FIX. The original 002 migration's RLS policies caused
-- "infinite recursion detected in policy for relation practice_users"
-- because the policies on practice_users referenced practice_users
-- recursively (and the policies on tenant tables did the same chain).
--
-- The standard solution: hoist the membership lookup into SECURITY DEFINER
-- functions that bypass RLS, then have the policies call those functions
-- instead of doing recursive subqueries.
--
-- Run this once in the Supabase SQL editor. It is idempotent —
-- safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper functions that bypass RLS ─────────────────────────────────────────

create or replace function public.user_is_practice_member(p_practice_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.practice_users
    where user_id = auth.uid()
      and practice_id = p_practice_id
  );
$$;

create or replace function public.user_is_practice_admin(p_practice_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.practice_users
    where user_id = auth.uid()
      and practice_id = p_practice_id
      and role in ('owner','admin','compliance_officer')
  );
$$;

grant execute on function public.user_is_practice_member(uuid) to authenticated;
grant execute on function public.user_is_practice_admin(uuid)  to authenticated;

-- ── practices ────────────────────────────────────────────────────────────────
drop policy if exists practices_member_read         on practices;
drop policy if exists practices_owner_write         on practices;
drop policy if exists practices_authenticated_create on practices;
drop policy if exists practices_admin_modify        on practices;
drop policy if exists practices_admin_delete        on practices;

-- Read: any practice member
create policy practices_member_read on practices for select
  using (user_is_practice_member(id));

-- Create: any authenticated user (the onboarding flow inserts here)
create policy practices_authenticated_create on practices for insert
  with check (auth.uid() is not null);

-- Update + delete: practice admins only
create policy practices_admin_modify on practices for update
  using  (user_is_practice_admin(id))
  with check (user_is_practice_admin(id));
create policy practices_admin_delete on practices for delete
  using (user_is_practice_admin(id));

-- ── practice_users ───────────────────────────────────────────────────────────
drop policy if exists practice_users_member_read on practice_users;
drop policy if exists practice_users_admin_write on practice_users;
drop policy if exists practice_users_select      on practice_users;
drop policy if exists practice_users_insert      on practice_users;
drop policy if exists practice_users_update      on practice_users;
drop policy if exists practice_users_delete      on practice_users;

-- Select: own row OR rows in practices you belong to
create policy practice_users_select on practice_users for select
  using (
    user_id = auth.uid()
    or user_is_practice_member(practice_id)
  );

-- Insert: inserting yourself (onboarding) OR an admin inserting others
create policy practice_users_insert on practice_users for insert
  with check (
    user_id = auth.uid()
    or user_is_practice_admin(practice_id)
  );

-- Update: own row OR admins updating others
create policy practice_users_update on practice_users for update
  using (
    user_id = auth.uid()
    or user_is_practice_admin(practice_id)
  )
  with check (
    user_id = auth.uid()
    or user_is_practice_admin(practice_id)
  );

-- Delete (offboarding): leave own membership OR admin removes someone
create policy practice_users_delete on practice_users for delete
  using (
    user_id = auth.uid()
    or user_is_practice_admin(practice_id)
  );

-- ── All other tenant tables: use the helpers ─────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'practice_controls','practice_evidence','evidence_snapshots',
    'drift_alerts','remediation_tasks','audit_logs',
    'vendors','baas','integrations',
    'risk_assessments','policies','policy_acknowledgments',
    'training_completions','reports'
  ] loop
    execute format('drop policy if exists "%1$s_member_read"    on %1$s', t);
    execute format('drop policy if exists "%1$s_officer_write"  on %1$s', t);

    execute format(
      'create policy "%1$s_member_read" on %1$s for select using (user_is_practice_member(practice_id))',
      t
    );
    execute format(
      'create policy "%1$s_officer_write" on %1$s for all using (user_is_practice_admin(practice_id)) with check (user_is_practice_admin(practice_id))',
      t
    );
  end loop;
end $$;
