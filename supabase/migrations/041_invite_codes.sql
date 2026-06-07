-- 041_invite_codes.sql
-- Adds the demo-invite system + the new 2-tier pricing model.
--
-- 1. Updates the practices.selected_plan check constraint from the old
--    (solo/practice/multisite) trio to the new (software/full_service) pair.
-- 2. Adds practices.access_expires_at + practices.plan_source so the
--    runtime gate can tell paid practices from invite-demo practices and
--    from unpaid ones, and knows when demo access ends.
-- 3. Adds the invite_codes + invite_redemptions tables.
-- 4. RLS policies — defense in depth; the primary gate is in API routes.

-- ── 1. Pricing model: update plan-name constraint ─────────────────────────
-- Clear stale values before swapping the check constraint so the rewrite
-- doesn't fail mid-migration.
update practices
  set selected_plan = null
  where selected_plan in ('solo','practice','multisite');

alter table practices
  drop constraint if exists practices_selected_plan_check;

alter table practices
  add constraint practices_selected_plan_check
  check (selected_plan in ('software','full_service'));

-- ── 2. Practice access state ──────────────────────────────────────────────
alter table practices
  add column if not exists access_expires_at timestamptz,
  add column if not exists plan_source text not null default 'unpaid'
    check (plan_source in ('unpaid','invite','stripe'));

create index if not exists idx_practices_access_expires
  on practices(access_expires_at)
  where access_expires_at is not null;

-- ── 3. Invite codes ───────────────────────────────────────────────────────
-- A row is created by a Fortify org admin (gate is API-level via the
-- FORTIFY_ADMIN_EMAILS env list — there's no DB column for "Fortify admin"
-- because the role is unrelated to any practice membership).
--
-- The "code" column is the URL-safe identifier shared in the invite link
-- (e.g. https://fortifynow.xyz/signup?invite=<code>). Generated with
-- crypto.randomBytes — 16 chars of hex = 128 bits of entropy, not guessable.
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  -- the configurable per-code knob: how long demo access lasts after
  -- redemption. Stored in minutes for flexibility (60 = 1 hour, 1440 = 1 day).
  access_duration_minutes int not null check (access_duration_minutes > 0),
  used_count int not null default 0,
  max_uses int not null default 1 check (max_uses > 0),
  link_expires_at timestamptz not null,
  revoked_at timestamptz,
  -- internal note, not shown to redeemer ("Rebecca, TIPA breakfast 2026-06-15")
  note text
);

create index if not exists idx_invite_codes_code on invite_codes(code);
create index if not exists idx_invite_codes_granted_by on invite_codes(granted_by);

-- ── 4. Invite redemptions ─────────────────────────────────────────────────
create table if not exists invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references invite_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  access_expires_at timestamptz not null,
  unique (code_id, user_id)
);

create index if not exists idx_invite_redemptions_code on invite_redemptions(code_id);
create index if not exists idx_invite_redemptions_practice on invite_redemptions(practice_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────
alter table invite_codes enable row level security;
alter table invite_redemptions enable row level security;

-- invite_codes: only the granter can see their own codes via the
-- authenticated client. Service-role (used by the public /preview route
-- after API-level validation) bypasses these.
drop policy if exists "invite_codes own read" on invite_codes;
create policy "invite_codes own read"
  on invite_codes for select
  to authenticated
  using (granted_by = auth.uid());

drop policy if exists "invite_codes own write" on invite_codes;
create policy "invite_codes own write"
  on invite_codes for all
  to authenticated
  using (granted_by = auth.uid())
  with check (granted_by = auth.uid());

-- invite_redemptions: practice members can see their own redemption row.
drop policy if exists "invite_redemptions visible to practice" on invite_redemptions;
create policy "invite_redemptions visible to practice"
  on invite_redemptions for select
  to authenticated
  using (
    exists (
      select 1 from practice_users
      where practice_id = invite_redemptions.practice_id
        and user_id = auth.uid()
    )
  );
