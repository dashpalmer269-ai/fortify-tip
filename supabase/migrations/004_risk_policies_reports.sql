-- ─────────────────────────────────────────────────────────────────────────────
-- 004_risk_policies_reports.sql
-- Risk assessments, policies, training, reports — Phase F schema.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Risk assessments ────────────────────────────────────────────────────────
create table if not exists risk_assessments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  framework text not null default 'HIPAA',
  assessment_date date not null default current_date,
  assessor_user_id uuid references auth.users(id),
  status text check (status in ('draft','submitted','approved')) default 'draft',
  answers jsonb,                 -- {question_key: answer_value}
  risk_score numeric(4,1),       -- 0-100, higher = higher risk
  risk_level text check (risk_level in ('low','medium','high','critical')),
  ai_executive_summary text,
  ai_remediation_plan text,
  report_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_risk_practice on risk_assessments(practice_id, assessment_date desc);

drop trigger if exists risk_touch on risk_assessments;
create trigger risk_touch before update on risk_assessments
  for each row execute function touch_updated_at();

-- ── Policies ────────────────────────────────────────────────────────────────
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  framework text,                       -- 'HIPAA' | 'SOC2' | 'ISO27001' | 'GDPR' | NULL = cross-cutting
  policy_type text not null,            -- 'security_policy' | 'incident_response' | 'access_control' | ...
  title text not null,
  content_markdown text not null,
  version int default 1,
  status text check (status in ('draft','active','archived')) default 'draft',
  ai_generated boolean default false,
  effective_date date,
  next_review_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_policies_practice on policies(practice_id);

drop trigger if exists policies_touch on policies;
create trigger policies_touch before update on policies
  for each row execute function touch_updated_at();

create table if not exists policy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz default now(),
  policy_version int not null,
  unique (policy_id, user_id, policy_version)
);

create index if not exists idx_ack_practice on policy_acknowledgments(practice_id);

-- ── Training ────────────────────────────────────────────────────────────────
create table if not exists training_modules (
  id uuid primary key default gen_random_uuid(),
  framework text,
  module_type text not null,            -- 'hipaa_awareness' | 'phishing' | 'incident_reporting' | ...
  title text not null,
  description text,
  content_markdown text not null,
  duration_minutes int default 15,
  passing_score int default 80,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists training_completions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references training_modules(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz default now(),
  score int,
  expires_on date,
  unique (module_id, user_id, completed_at)
);

create index if not exists idx_training_practice on training_completions(practice_id, completed_at desc);

-- ── Reports ─────────────────────────────────────────────────────────────────
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  report_type text not null,            -- 'audit_readiness' | 'monthly_summary' | 'risk_snapshot'
  framework text,                       -- null = all frameworks
  generated_at timestamptz default now(),
  generated_by uuid references auth.users(id),
  snapshot jsonb,                       -- frozen state at moment of generation
  ai_executive_summary text,
  file_url text,                        -- supabase storage path for PDF when available
  created_at timestamptz default now()
);

create index if not exists idx_reports_practice on reports(practice_id, generated_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table risk_assessments        enable row level security;
alter table policies                enable row level security;
alter table policy_acknowledgments  enable row level security;
alter table training_modules        enable row level security;
alter table training_completions    enable row level security;
alter table reports                 enable row level security;

-- training_modules = global library, read for any authenticated user
drop policy if exists training_modules_read on training_modules;
create policy training_modules_read on training_modules
  for select using (auth.role() = 'authenticated');

-- Per-tenant tables: members read, officers write
do $$
declare t text;
begin
  foreach t in array array[
    'risk_assessments','policies','policy_acknowledgments',
    'training_completions','reports'
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

grant all on risk_assessments to service_role;
grant all on policies to service_role;
grant all on policy_acknowledgments to service_role;
grant all on training_modules to service_role;
grant all on training_completions to service_role;
grant all on reports to service_role;
