-- 017_exclusion_screening.sql
-- Exclusion screening subsystem.
--
-- Source-of-truth tables for OIG LEIE / SAM.gov records, per-screening event
-- log, and the workforce-latest view. Adds first_name + last_name + DOB to
-- user_profiles and vendors so we have the inputs for screening. Wires a new
-- control (WFC-001) into the unified mapping engine with HIPAA + SOC 2 mappings
-- and an automated evidence_check for daily readiness scoring.

create extension if not exists pg_trgm;

-- ── User profile name/DOB fields ──────────────────────────────────────────
alter table user_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists date_of_birth date;

-- ── Vendor contact fields (in addition to existing contact_name) ──────────
alter table vendors
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name  text,
  add column if not exists contact_date_of_birth date;

-- ── Exclusion list records (canonical) ────────────────────────────────────
create table if not exists exclusion_list_records (
  id uuid primary key default gen_random_uuid(),

  source text not null check (source in ('OIG_LEIE','SAM_GOV')),
  source_record_id text not null,
  source_snapshot_date date not null,

  first_name text,
  middle_name text,
  last_name text,
  business_name text,
  date_of_birth date,

  address_line text,
  city text,
  state text,
  zip text,

  exclusion_type text,
  exclusion_date date,
  reinstatement_date date,

  -- normalized for matching: uppercase, NFKD, diacritics stripped, suffixes removed
  first_name_normalized text,
  last_name_normalized text,
  business_name_normalized text,

  raw_payload jsonb,
  imported_at timestamptz default now(),

  unique (source, source_record_id, source_snapshot_date)
);

create index if not exists exclusion_match_exact
  on exclusion_list_records (last_name_normalized, first_name_normalized, date_of_birth)
  where reinstatement_date is null;

create index if not exists exclusion_match_trgm_last
  on exclusion_list_records using gin (last_name_normalized gin_trgm_ops);

create index if not exists exclusion_match_trgm_first
  on exclusion_list_records using gin (first_name_normalized gin_trgm_ops);

create index if not exists exclusion_match_trgm_business
  on exclusion_list_records using gin (business_name_normalized gin_trgm_ops);

create index if not exists exclusion_active_only
  on exclusion_list_records (source) where reinstatement_date is null;

alter table exclusion_list_records enable row level security;
-- Read-only via authenticated; writes service-role only.
drop policy if exists exclusion_records_read on exclusion_list_records;
create policy exclusion_records_read on exclusion_list_records for select
  to authenticated using (true);
grant select on exclusion_list_records to authenticated;
grant all on exclusion_list_records to service_role;

comment on table exclusion_list_records is
  'NO PHI. Records from federal exclusion lists (OIG LEIE, SAM.gov). Public data; the only sensitive aspect is its mapping to live workforce screenings.';

-- ── Snapshot tracking ─────────────────────────────────────────────────────
create table if not exists exclusion_list_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  snapshot_date date not null,
  source_etag text,
  records_total int,
  records_added int,
  records_removed int,
  imported_at timestamptz default now(),
  unique (source, snapshot_date)
);

alter table exclusion_list_snapshots enable row level security;
grant all on exclusion_list_snapshots to service_role;

-- ── Screening events (append-only audit) ──────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'screening_status') then
    create type screening_status as enum (
      'pending', 'cleared', 'review_required', 'blocked', 'overridden_clear'
    );
  end if;
end $$;

create table if not exists exclusion_screenings (
  id uuid primary key default gen_random_uuid(),

  subject_type text not null check (subject_type in ('workforce_member','vendor_contact')),
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_vendor_id uuid references vendors(id) on delete set null,
  practice_id uuid references practices(id) on delete cascade,

  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  address_line text,
  city text, state text, zip text,

  status screening_status not null default 'pending',
  tier1_match_count int default 0,
  tier2_match_count int,
  matched_record_ids uuid[] default '{}',

  screened_at timestamptz default now() not null,
  expires_at timestamptz,

  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  notification_sent_at timestamptz,
  user_message_shown text,

  constraint subject_consistency check (
    (subject_type = 'workforce_member' and subject_user_id is not null)
    or (subject_type = 'vendor_contact' and subject_vendor_id is not null)
  )
);

create index if not exists screening_subject_user
  on exclusion_screenings (subject_user_id, screened_at desc);
create index if not exists screening_subject_vendor
  on exclusion_screenings (subject_vendor_id, screened_at desc);
create index if not exists screening_practice_status
  on exclusion_screenings (practice_id, status);
create index if not exists screening_due_for_rescreen
  on exclusion_screenings (expires_at)
  where subject_type = 'workforce_member' and status in ('cleared','overridden_clear');

alter table exclusion_screenings enable row level security;

-- Authenticated practice members can read screenings tied to their practice.
drop policy if exists screenings_member_read on exclusion_screenings;
create policy screenings_member_read on exclusion_screenings for select
  to authenticated
  using (
    practice_id is not null and user_is_practice_member(practice_id)
    or subject_user_id = (select auth.uid())
  );

grant select on exclusion_screenings to authenticated;
grant all on exclusion_screenings to service_role;

comment on table exclusion_screenings is
  'NO PHI. Append-only audit of every exclusion screening. DOB is workforce-member or vendor-contact metadata only — never patient data.';

-- ── Fuzzy match RPC (called from lib/screening/matcher.ts) ────────────────
create or replace function match_exclusion_fuzzy(
  p_first_normalized text,
  p_last_normalized  text,
  p_dob              date,
  p_threshold        real default 0.85
)
returns table (
  id uuid, source text,
  first_name text, middle_name text, last_name text, business_name text,
  date_of_birth date,
  address_line text, city text, state text, zip text,
  exclusion_type text, exclusion_date date
)
language sql
stable
as $$
  select
    e.id, e.source,
    e.first_name, e.middle_name, e.last_name, e.business_name,
    e.date_of_birth,
    e.address_line, e.city, e.state, e.zip,
    e.exclusion_type, e.exclusion_date
  from exclusion_list_records e
  where e.reinstatement_date is null
    and e.date_of_birth = p_dob
    and similarity(e.last_name_normalized, p_last_normalized) >= p_threshold
    and similarity(e.first_name_normalized, p_first_normalized) >= p_threshold
  order by similarity(e.last_name_normalized, p_last_normalized) desc
  limit 25
$$;

grant execute on function match_exclusion_fuzzy(text, text, date, real) to authenticated;
grant execute on function match_exclusion_fuzzy(text, text, date, real) to service_role;

-- ── Latest-screening per workforce member view ────────────────────────────
create or replace view workforce_screening_latest as
select distinct on (subject_user_id, practice_id)
  subject_user_id,
  practice_id,
  status,
  screened_at,
  expires_at,
  id as screening_id
from exclusion_screenings
where subject_type = 'workforce_member'
order by subject_user_id, practice_id, screened_at desc;

grant select on workforce_screening_latest to authenticated;

-- ── WFC-001 control + framework mappings + evidence_check ─────────────────
insert into controls (control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active)
values (
  'WFC-001',
  'Workforce exclusion screening current',
  'Every workforce member is screened against OIG LEIE and SAM.gov at onboarding and re-screened every 28 days. Vendor contacts are screened during BAA addition. No workforce member with a blocked screening retains access.',
  'workforce', 'administrative', 'critical', true, true
)
on conflict (control_key) do nothing;

-- Map WFC-001 to relevant requirements
do $$
declare
  ctrl_wfc001 uuid := (select id from controls where control_key = 'WFC-001');
  r_hipaa_308a3i  uuid := (select id from framework_requirements where citation = '164.308(a)(3)(i)');
  r_hipaa_308a4i  uuid := (select id from framework_requirements where citation = '164.308(a)(4)(i)');
  r_hipaa_308b1   uuid := (select id from framework_requirements where citation = '164.308(b)(1)');
  r_soc2_cc11     uuid := (select id from framework_requirements where citation = 'CC1.1');
  r_soc2_cc61     uuid := (select id from framework_requirements where citation = 'CC6.1');
  r_iso_a515      uuid := (select id from framework_requirements where citation = 'A.5.15');
  r_iso_a516      uuid := (select id from framework_requirements where citation = 'A.5.16');
begin
  if ctrl_wfc001 is null then return; end if;

  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength)
  select ctrl_wfc001, x.req, x.strength from (values
    (r_hipaa_308a3i, 'fully_satisfies'),
    (r_hipaa_308a4i, 'partially_satisfies'),
    (r_hipaa_308b1,  'partially_satisfies'),
    (r_soc2_cc11,    'fully_satisfies'),
    (r_soc2_cc61,    'partially_satisfies'),
    (r_iso_a515,     'partially_satisfies'),
    (r_iso_a516,     'partially_satisfies')
  ) x(req, strength)
  where x.req is not null
  on conflict do nothing;
end $$;

-- Evidence check: run daily, queries the workforce_screening_latest view
insert into evidence_checks (control_id, check_key, title, description, collection_method, frequency_hours, pass_criteria)
select
  c.id,
  'workforce_screening_currency',
  'All active workforce members have a cleared screening within the last 28 days',
  'Counts active workforce members and verifies every one has a current cleared screening. Fails if any blocked or stale screening exists.',
  'automated_db_query',
  24,
  '{"min_pct_screened_current":100,"max_blocked":0}'::jsonb
from controls c
where c.control_key = 'WFC-001'
on conflict (control_id, check_key) do nothing;

-- Remediation guidance
insert into remediation_guidance (control_id, severity, title, step_by_step_markdown, estimated_effort_minutes, ai_generated)
select
  c.id, 'critical',
  'Workforce exclusion screening current',
  'Run a fresh screening on every workforce member.\n\n1. Open Fortify and navigate to Edit Staff.\n2. The "Last screened" column shows each member''s currency. Any past 28 days are due.\n3. Click Re-screen on each due member (or wait for the daily cron at 04:30 UTC).\n4. For any blocked result, the member''s access is automatically suspended. Review and either resolve with the member or escalate to compliance.\n5. For vendors: add date-of-birth on the contact and re-save to trigger a fresh BAA screening.',
  30, false
from controls c
where c.control_key = 'WFC-001'
on conflict do nothing;

-- ── Apply No-PHI CHECK to free-text columns we added ──────────────────────
do $$
declare
  cols jsonb := jsonb_build_array(
    jsonb_build_object('table','user_profiles','column','first_name'),
    jsonb_build_object('table','user_profiles','column','last_name'),
    jsonb_build_object('table','vendors','column','contact_first_name'),
    jsonb_build_object('table','vendors','column','contact_last_name')
  );
  c jsonb; t text; col text; constraint_name text;
begin
  for c in select * from jsonb_array_elements(cols) loop
    t := c->>'table'; col := c->>'column';
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = col
    ) then continue; end if;
    constraint_name := format('no_phi_%s_%s', t, col);
    execute format('alter table public.%I drop constraint if exists %I', t, constraint_name);
    execute format('alter table public.%I add constraint %I check (_no_phi_check(%I))', t, constraint_name, col);
  end loop;
end $$;
