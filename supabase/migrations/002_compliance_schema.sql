-- ─────────────────────────────────────────────────────────────────────────────
-- 002_compliance_schema.sql
-- Multi-framework healthcare compliance control library + multi-tenant SaaS.
-- One control row can satisfy many requirements across HIPAA, SOC 2, ISO 27001,
-- and GDPR via framework_mappings. Tenant state is isolated via RLS on practice_id.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Tenancy ─────────────────────────────────────────────────────────────────
create table if not exists practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size_tier text check (size_tier in ('solo','small','medium','large')),
  practice_type text,
  hipaa_covered_entity boolean default true,
  frameworks_enabled text[] default array['HIPAA'],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists practice_users (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in
    ('owner','admin','compliance_officer','staff','auditor_readonly')),
  created_at timestamptz default now(),
  unique (practice_id, user_id)
);

create index if not exists idx_practice_users_user on practice_users(user_id);

-- ── Global regulatory library ───────────────────────────────────────────────
create table if not exists frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  authority text,
  current_version text,
  description text,
  active boolean default true
);

create table if not exists framework_requirements (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references frameworks(id) on delete cascade,
  citation text not null,
  parent_citation text,
  title text not null,
  description text not null,
  category text,
  obligation_type text check (obligation_type in ('required','addressable','recommended')),
  weight numeric(3,2) default 1.0,
  source_url text,
  unique (framework_id, citation)
);

create index if not exists idx_reqs_framework on framework_requirements(framework_id);

create table if not exists controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  title text not null,
  description text not null,
  category text not null,
  implementation_type text check (implementation_type in ('technical','administrative','physical')),
  default_priority text check (default_priority in ('critical','high','medium','low')) default 'high',
  healthcare_baseline boolean default false,
  active boolean default true
);

create table if not exists framework_mappings (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references controls(id) on delete cascade,
  framework_requirement_id uuid not null references framework_requirements(id) on delete cascade,
  mapping_strength text check (mapping_strength in
    ('fully_satisfies','partially_satisfies','contributes_to')) default 'fully_satisfies',
  notes text,
  unique (control_id, framework_requirement_id)
);

create index if not exists idx_mappings_control on framework_mappings(control_id);
create index if not exists idx_mappings_req on framework_mappings(framework_requirement_id);

-- ── Evidence collection ─────────────────────────────────────────────────────
create table if not exists evidence_checks (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references controls(id) on delete cascade,
  check_key text not null,
  title text not null,
  description text,
  collection_method text not null check (collection_method in (
    'automated_api',
    'automated_db_query',
    'automated_scan',
    'document_upload',
    'manual_attestation',
    'screenshot'
  )),
  source_integration text,
  frequency_hours int default 24,
  check_config jsonb,
  pass_criteria jsonb,
  evidence_retention_days int default 2555,
  unique (control_id, check_key)
);

create table if not exists practice_evidence (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  evidence_check_id uuid not null references evidence_checks(id) on delete cascade,
  status text check (status in ('pass','fail','partial','not_collected','error')),
  collected_at timestamptz default now(),
  collected_by uuid references auth.users(id),
  raw_result jsonb,
  observed_value jsonb,
  state_hash text,
  evidence_file_url text,
  notes text,
  is_current boolean default true
);

create index if not exists idx_practice_evidence_current
  on practice_evidence (practice_id, evidence_check_id)
  where is_current;
create index if not exists idx_practice_evidence_collected
  on practice_evidence (collected_at desc);

-- ── Practice control state ─────────────────────────────────────────────────
create table if not exists practice_controls (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  control_id uuid not null references controls(id) on delete cascade,
  status text not null check (status in
    ('compliant','partial','non_compliant','not_applicable','not_started')) default 'not_started',
  not_applicable_reason text,
  owner_user_id uuid references auth.users(id),
  last_verified_at timestamptz,
  next_review_due timestamptz,
  implementation_notes text,
  unique (practice_id, control_id)
);

create index if not exists idx_practice_controls_practice on practice_controls(practice_id);

-- ── Remediation ─────────────────────────────────────────────────────────────
create table if not exists remediation_guidance (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references controls(id) on delete cascade,
  severity text check (severity in ('critical','high','medium','low')),
  title text not null,
  step_by_step_markdown text not null,
  estimated_effort_minutes int,
  required_systems text[],
  ai_generated boolean default false,
  source_url text
);

create table if not exists remediation_tasks (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  practice_control_id uuid references practice_controls(id) on delete cascade,
  guidance_id uuid references remediation_guidance(id),
  assigned_to uuid references auth.users(id),
  status text check (status in ('open','in_progress','blocked','done','dismissed')) default 'open',
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_remediation_tasks_practice on remediation_tasks(practice_id);

-- ── Configuration drift ─────────────────────────────────────────────────────
create table if not exists evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  evidence_check_id uuid not null references evidence_checks(id) on delete cascade,
  state_hash text not null,
  observed_value jsonb,
  captured_at timestamptz default now()
);

create index if not exists idx_snapshots_pcheck
  on evidence_snapshots (practice_id, evidence_check_id, captured_at desc);

create table if not exists drift_alerts (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  evidence_check_id uuid not null references evidence_checks(id) on delete cascade,
  previous_state jsonb,
  current_state jsonb,
  severity text check (severity in ('critical','high','medium','low')),
  detected_at timestamptz default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id)
);

create index if not exists idx_drift_practice on drift_alerts(practice_id, detected_at desc);

-- ── Audit log (HIPAA §164.312(b), SOC 2 CC7.2) ─────────────────────────────
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_service text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz default now()
);

create index if not exists idx_audit_practice on audit_logs (practice_id, occurred_at desc);
create index if not exists idx_audit_resource on audit_logs (resource_type, resource_id);

-- ── updated_at trigger for practices ────────────────────────────────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists practices_touch on practices;
create trigger practices_touch before update on practices
  for each row execute function touch_updated_at();

-- ── Audit readiness scoring function ────────────────────────────────────────
-- Returns weighted satisfaction % for a given (practice, framework) pair,
-- broken down by category. Required obligations weigh 1.5×, addressable 1.0×,
-- recommended 0.5×. partially_satisfies mappings count at half weight.
create or replace function audit_readiness(
  p_practice_id uuid,
  p_framework_code text
) returns table (
  framework text,
  satisfied_requirements int,
  total_requirements int,
  weighted_pct numeric,
  category_breakdown jsonb
)
language sql stable as $$
  with reqs as (
    select fr.id, fr.category, fr.weight, fr.obligation_type
    from framework_requirements fr
    join frameworks f on f.id = fr.framework_id
    where f.code = p_framework_code
  ),
  -- A requirement is "satisfied" when at least one mapped control is compliant.
  satisfaction as (
    select
      r.id as req_id,
      r.category,
      r.weight * case r.obligation_type
        when 'required' then 1.5
        when 'addressable' then 1.0
        when 'recommended' then 0.5
        else 1.0
      end as scaled_weight,
      max(case
        when pc.status = 'compliant' and fm.mapping_strength = 'fully_satisfies' then 1.0
        when pc.status = 'compliant' and fm.mapping_strength = 'partially_satisfies' then 0.5
        when pc.status = 'compliant' and fm.mapping_strength = 'contributes_to' then 0.25
        else 0
      end) as satisfaction_factor
    from reqs r
    left join framework_mappings fm on fm.framework_requirement_id = r.id
    left join practice_controls pc
      on pc.control_id = fm.control_id and pc.practice_id = p_practice_id
    group by r.id, r.category, r.weight, r.obligation_type
  ),
  -- Per-category rollup (single level of aggregation — no nesting)
  by_category as (
    select
      coalesce(category, 'uncategorized') as cat,
      count(*) filter (where satisfaction_factor >= 1.0) as cat_satisfied,
      count(*) as cat_total,
      round(
        100.0 * sum(scaled_weight * satisfaction_factor)
              / nullif(sum(scaled_weight), 0),
        1
      ) as cat_pct
    from satisfaction
    group by coalesce(category, 'uncategorized')
  ),
  -- Overall totals (single level of aggregation)
  totals as (
    select
      count(*) filter (where satisfaction_factor >= 1.0)::int as t_satisfied,
      count(*)::int as t_total,
      round(
        100.0 * sum(scaled_weight * satisfaction_factor)
              / nullif(sum(scaled_weight), 0),
        1
      ) as t_pct
    from satisfaction
  ),
  -- Assemble JSON from already-aggregated rows (no nested aggregates)
  cats_json as (
    select coalesce(
      jsonb_object_agg(
        cat,
        jsonb_build_object(
          'satisfied',    cat_satisfied,
          'total',        cat_total,
          'weighted_pct', cat_pct
        )
      ),
      '{}'::jsonb
    ) as breakdown
    from by_category
  )
  select
    p_framework_code,
    totals.t_satisfied,
    totals.t_total,
    totals.t_pct,
    cats_json.breakdown
  from totals
  cross join cats_json;
$$;

-- ── Convenience: list all enabled frameworks for a practice with score ─────
create or replace function audit_readiness_summary(p_practice_id uuid)
returns table (
  framework_code text,
  weighted_pct numeric,
  satisfied int,
  total int
)
language sql stable as $$
  select
    f.code,
    r.weighted_pct,
    r.satisfied_requirements,
    r.total_requirements
  from frameworks f
  join practices p on p.id = p_practice_id
  cross join lateral audit_readiness(p_practice_id, f.code) r
  where f.code = any (p.frameworks_enabled);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Global library = world-readable to authenticated users; writes via service role.
-- Tenant tables  = readable + writable only to practice members.
-- ─────────────────────────────────────────────────────────────────────────────

alter table frameworks            enable row level security;
alter table framework_requirements enable row level security;
alter table controls              enable row level security;
alter table framework_mappings    enable row level security;
alter table evidence_checks       enable row level security;
alter table remediation_guidance  enable row level security;

alter table practices             enable row level security;
alter table practice_users        enable row level security;
alter table practice_controls     enable row level security;
alter table practice_evidence     enable row level security;
alter table evidence_snapshots    enable row level security;
alter table drift_alerts          enable row level security;
alter table remediation_tasks     enable row level security;
alter table audit_logs            enable row level security;

-- Global library — read for authenticated, write only via service role.
-- NOTE: PL/pgSQL EXECUTE only accepts one statement per call, so we split
-- the drop/create into two separate EXECUTEs.
do $$
declare t text;
begin
  foreach t in array array[
    'frameworks','framework_requirements','controls',
    'framework_mappings','evidence_checks','remediation_guidance'
  ] loop
    execute format('drop policy if exists "%1$s_read_authenticated" on %1$s', t);
    execute format(
      'create policy "%1$s_read_authenticated" on %1$s for select using (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;

-- Tenant tables — only members of the practice can read; admins/officers can write
-- practices
drop policy if exists practices_member_read on practices;
create policy practices_member_read on practices for select using (
  id in (select practice_id from practice_users where user_id = auth.uid())
);
drop policy if exists practices_owner_write on practices;
create policy practices_owner_write on practices for all using (
  id in (select practice_id from practice_users
         where user_id = auth.uid() and role in ('owner','admin'))
);

-- practice_users
drop policy if exists practice_users_member_read on practice_users;
create policy practice_users_member_read on practice_users for select using (
  practice_id in (select practice_id from practice_users where user_id = auth.uid())
);
drop policy if exists practice_users_admin_write on practice_users;
create policy practice_users_admin_write on practice_users for all using (
  practice_id in (select practice_id from practice_users
                  where user_id = auth.uid() and role in ('owner','admin'))
);

-- Generic tenant tables (read for members, write for admin/officer)
do $$
declare t text;
begin
  foreach t in array array[
    'practice_controls','practice_evidence','evidence_snapshots',
    'drift_alerts','remediation_tasks','audit_logs'
  ] loop
    execute format('drop policy if exists "%1$s_member_read" on %1$s', t);
    execute format($p$
      create policy "%1$s_member_read" on %1$s for select using (
        practice_id in (select practice_id from practice_users where user_id = auth.uid())
      )
    $p$, t);
    execute format('drop policy if exists "%1$s_officer_write" on %1$s', t);
    execute format($p$
      create policy "%1$s_officer_write" on %1$s for all using (
        practice_id in (select practice_id from practice_users
                        where user_id = auth.uid()
                          and role in ('owner','admin','compliance_officer'))
      )
    $p$, t);
  end loop;
end $$;

-- ── Grants for service-role ingestion ──────────────────────────────────────
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
