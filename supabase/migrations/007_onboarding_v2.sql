-- ─────────────────────────────────────────────────────────────────────────────
-- 007_onboarding_v2.sql
-- Adds fields and tables needed by the 4-step onboarding wizard:
--   Step 2 — Information (practice description, sizing, locations)
--   Step 3 — Fortification (current status, audit timing)
--   Step 4 — Safeguards (integration choices or scheduled assistance)
--   Step 5 — Payment (plan + completion timestamp)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── practices: extra columns ────────────────────────────────────────────────
alter table practices
  add column if not exists description text,
  add column if not exists employee_range text
    check (employee_range in ('1-20','21-50','51+')),
  add column if not exists location_count_range text
    check (location_count_range in ('1-2','3-5','5+')),
  add column if not exists current_status text
    check (current_status in ('starting_brand_new','maintenance_needed','transfer_from_other')),
  add column if not exists upcoming_audit_window text
    check (upcoming_audit_window in ('within_30_days','within_60_days','within_90_days','beyond_90_days')),
  add column if not exists selected_plan text
    check (selected_plan in ('solo','practice','multisite')),
  add column if not exists onboarding_step text default 'information'
    check (onboarding_step in ('information','fortification','safeguards','payment','completed')),
  add column if not exists onboarding_completed_at timestamptz;

-- ── practice_locations: address per location being onboarded ───────────────
create table if not exists practice_locations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  label text,
  street_1 text not null,
  street_2 text,
  city text not null,
  region text not null,                  -- state / province
  postal_code text not null,
  country text default 'US',
  created_at timestamptz default now()
);

create index if not exists idx_practice_locations on practice_locations(practice_id);

alter table practice_locations enable row level security;
drop policy if exists practice_locations_member_read   on practice_locations;
drop policy if exists practice_locations_officer_write on practice_locations;

create policy practice_locations_member_read on practice_locations
  for select using (user_is_practice_member(practice_id));

create policy practice_locations_officer_write on practice_locations
  for all
  using (user_is_practice_admin(practice_id))
  with check (user_is_practice_admin(practice_id));

-- ── onboarding_integration_choices: queue from Step 4 ───────────────────────
create table if not exists onboarding_integration_choices (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  integration_type text not null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_onb_int_practice on onboarding_integration_choices(practice_id);

alter table onboarding_integration_choices enable row level security;
drop policy if exists onb_int_member_read   on onboarding_integration_choices;
drop policy if exists onb_int_officer_write on onboarding_integration_choices;

create policy onb_int_member_read on onboarding_integration_choices
  for select using (user_is_practice_member(practice_id));

create policy onb_int_officer_write on onboarding_integration_choices
  for all
  using (user_is_practice_admin(practice_id))
  with check (user_is_practice_admin(practice_id));

-- ── assistance_requests: from Step 4 "Schedule Assistance" option ──────────
create table if not exists assistance_requests (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  preferred_date date,
  preferred_time_window text,            -- 'morning' | 'afternoon' | 'evening' | 'flexible'
  contact_email text,
  contact_phone text,
  notes text,
  status text default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  created_at timestamptz default now()
);

create index if not exists idx_assistance_practice on assistance_requests(practice_id);

alter table assistance_requests enable row level security;
drop policy if exists assistance_member_read   on assistance_requests;
drop policy if exists assistance_officer_write on assistance_requests;

create policy assistance_member_read on assistance_requests
  for select using (user_is_practice_member(practice_id));

create policy assistance_officer_write on assistance_requests
  for all
  using (user_is_practice_admin(practice_id))
  with check (user_is_practice_admin(practice_id));

grant all on practice_locations             to service_role;
grant all on onboarding_integration_choices to service_role;
grant all on assistance_requests            to service_role;
