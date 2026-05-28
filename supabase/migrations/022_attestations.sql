-- 022_attestations.sql
-- In-product attestation deliverables: the formal HIPAA Security Risk
-- Assessment attestation and SOC 2 readiness report. Each row freezes a
-- snapshot of the practice's posture at generation time, carries an
-- AI-written executive summary, and supports BOTH signing paths:
--   - e_signature: signed in-product, immutable record (signer name/title/ip/timestamp)
--   - print_and_sign: rendered to a printable doc the security officer signs offline
--
-- document_hash anchors immutability: sha256 over the frozen snapshot +
-- summary, computed at generation. A signed attestation must never have its
-- snapshot mutated.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'attestation_type') then
    create type attestation_type as enum ('hipaa_sra', 'soc2_readiness');
  end if;
  if not exists (select 1 from pg_type where typname = 'attestation_status') then
    create type attestation_status as enum ('draft', 'signed', 'superseded');
  end if;
end $$;

create table if not exists attestations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,

  type attestation_type not null,
  status attestation_status not null default 'draft',
  title text not null,

  snapshot jsonb not null,            -- frozen posture (readiness, controls, evidence, vendors, screening)
  executive_summary text,             -- AI-generated narrative
  document_hash text not null,        -- sha256(snapshot + summary) — immutability anchor

  period_start date,
  period_end date,

  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),

  -- Signing (null until signed)
  signed_by uuid references auth.users(id) on delete set null,
  signer_name text,
  signer_title text,
  signed_at timestamptz,
  signature_method text check (signature_method in ('e_signature','print_and_sign')),
  signature_ip text,
  signature_statement text,           -- the attestation language the signer agreed to

  created_at timestamptz not null default now()
);

create index if not exists idx_attestations_practice
  on attestations (practice_id, generated_at desc);
create index if not exists idx_attestations_practice_type
  on attestations (practice_id, type, status);

alter table attestations enable row level security;

drop policy if exists attestations_member_read on attestations;
create policy attestations_member_read on attestations for select
  to authenticated using (user_is_practice_member(practice_id));

drop policy if exists attestations_admin_write on attestations;
create policy attestations_admin_write on attestations for all
  to authenticated
  using (user_is_practice_admin(practice_id))
  with check (user_is_practice_admin(practice_id));

grant select, insert, update on attestations to authenticated;
grant all on attestations to service_role;

comment on table attestations is
  'NO PHI. Formal compliance deliverables (HIPAA SRA attestation, SOC 2 readiness). snapshot is frozen posture metadata. Signed rows are immutable — never mutate snapshot after signing.';

-- ── Add the attestation control to the library + map it ───────────────────
insert into controls (control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active)
values (
  'DOC-001',
  'Security Risk Assessment documented and signed',
  'A current HIPAA Security Risk Assessment is generated, reviewed, and signed by the practice security officer at least annually. Required documentation for OCR audits.',
  'documentation', 'administrative', 'critical', true, true
)
on conflict (control_key) do nothing;

do $$
declare
  ctrl uuid := (select id from controls where control_key = 'DOC-001');
  r_hipaa_308a1iiA uuid := (select id from framework_requirements where citation = '164.308(a)(1)(ii)(A)');
  r_hipaa_308a8    uuid := (select id from framework_requirements where citation = '164.308(a)(8)');
  r_soc2_cc11      uuid := (select id from framework_requirements where citation = 'CC1.1');
begin
  if ctrl is null then return; end if;
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength)
  select ctrl, x.req, x.s from (values
    (r_hipaa_308a1iiA, 'fully_satisfies'),
    (r_hipaa_308a8,    'fully_satisfies'),
    (r_soc2_cc11,      'partially_satisfies')
  ) x(req, s) where x.req is not null
  on conflict do nothing;
end $$;
