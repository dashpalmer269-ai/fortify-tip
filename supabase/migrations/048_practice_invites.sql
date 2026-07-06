-- 048_practice_invites.sql
-- Real email-based team invites.
--
-- Replaces the audit-log-only stub behind POST /api/invites/queue with a
-- durable practice_invites table. The plaintext token lives only in the
-- emailed URL (https://fortifynow.xyz/join/<token>); the database stores
-- sha256(token) — same posture as invite_codes (migration 042).
--
-- Redemption paths:
--   1. Silent: /auth/callback matches the verified email against a pending
--      invite and creates the membership immediately after signup.
--   2. Explicit: /join/<token> shows the invite and an Accept button which
--      calls POST /api/invites/redeem.

create table if not exists practice_invites (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  -- always stored lowercased; the API normalizes before insert
  email text not null check (email = lower(email)),
  role text not null default 'staff'
    check (role in ('admin','compliance_officer','staff','auditor_readonly')),
  token_hash text unique not null,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null
);

-- One live invite per address per practice. Re-inviting after acceptance,
-- revocation, or expiry cleanup is allowed.
create unique index if not exists idx_practice_invites_pending_unique
  on practice_invites(practice_id, email)
  where status = 'pending';

-- Redemption lookup on login/signup is by email.
create index if not exists idx_practice_invites_email
  on practice_invites(email)
  where status = 'pending';

create index if not exists idx_practice_invites_practice
  on practice_invites(practice_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Reads: practice owner/admins see their practice's invites (team page).
-- Writes: service-role only — creation, revocation, and redemption all go
-- through API routes that verify the caller before touching the table.
alter table practice_invites enable row level security;

drop policy if exists "practice_invites admin read" on practice_invites;
create policy "practice_invites admin read"
  on practice_invites for select
  to authenticated
  using (
    exists (
      select 1 from practice_users
      where practice_users.practice_id = practice_invites.practice_id
        and practice_users.user_id = auth.uid()
        and practice_users.role in ('owner','admin')
    )
  );
