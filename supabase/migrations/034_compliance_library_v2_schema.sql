-- 034_compliance_library_v2_schema.sql
-- Compliance library v2 — schema extensions only. Adds the columns the v2
-- content layer needs without restructuring the established architecture.
--
-- What this migration adds:
--   • evidence_checks: evidence_required, manual_upload_allowed,
--     attestation_acceptable, automation_level, satisfaction_rule
--   • framework_requirements: source_type, last_reviewed_at, reviewed_by,
--     interpretation_notes, is_official_language
--   • framework_mappings: mapping_confidence, interpretation_basis,
--     last_reviewed_at, reviewed_by
--   • controls: default_weight (per-control risk weighting),
--     responsible_role (who owns it in a typical practice)
--   • Extends controls.audience enum to cover the v2 audience system
--   • Adds an automation_level column on controls (separate from the older
--     automation_status, kept for back-compat) with the v2 label vocabulary
--   • remediation_guidance: framework_impact, responsible_role, risk_level,
--     evidence_after_remediation, due_date_logic, why_it_matters
--
-- All changes are additive. Existing data unaffected. Backfill in 035.

-- ─── 1. evidence_checks ─────────────────────────────────────────────────
alter table evidence_checks
  add column if not exists evidence_required boolean not null default true,
  add column if not exists manual_upload_allowed boolean not null default true,
  add column if not exists attestation_acceptable boolean not null default true,
  add column if not exists automation_level text check (automation_level in (
    'auto_verified',
    'partially_verified',
    'manual_evidence_required',
    'admin_attestation',
    'managed_review_required',
    'needs_integration'
  )),
  add column if not exists satisfaction_rule jsonb;

comment on column evidence_checks.evidence_required is
  'Whether the practice MUST produce evidence for this check (default true). False for optional/documentation checks.';
comment on column evidence_checks.manual_upload_allowed is
  'Whether an admin may upload a document to satisfy this check (in addition to or instead of automated collection).';
comment on column evidence_checks.attestation_acceptable is
  'Whether an admin attestation alone satisfies the check.';
comment on column evidence_checks.automation_level is
  'How the check is verified end-to-end. auto_verified = integration scan decides; partially_verified = integration signal plus human confirm; manual_evidence_required = customer uploads; admin_attestation = renewal cadence; managed_review_required = needs Fortify review; needs_integration = nothing automated yet for this control.';
comment on column evidence_checks.satisfaction_rule is
  'Declarative pass/fail logic in jsonb. Example: {"any_of":[{"source":"integration","status":"pass"},{"source":"document_upload","age_days_lte":365},{"source":"attestation","age_days_lte":90}]}. Read by the runner''s recompute path.';

-- ─── 2. framework_requirements: source provenance ──────────────────────
alter table framework_requirements
  add column if not exists source_type text check (source_type in (
    'statute', 'regulation', 'standard', 'guidance', 'interpretation', 'cross_reference'
  )),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists interpretation_notes text,
  add column if not exists is_official_language boolean not null default true;

comment on column framework_requirements.source_type is
  'Provenance tier: statute (e.g. HIPAA Privacy Rule), regulation (CFR), standard (ISO/AICPA), guidance (HHS guidance documents), interpretation (Fortify analysis), cross_reference (mapping from another framework).';
comment on column framework_requirements.is_official_language is
  'True when the description is the verbatim/near-verbatim official text. False when paraphrased by Fortify for readability — flag interpretation_notes accordingly.';

-- ─── 3. framework_mappings: defensibility ──────────────────────────────
alter table framework_mappings
  add column if not exists mapping_confidence text not null default 'high' check (mapping_confidence in ('high', 'medium', 'low')),
  add column if not exists interpretation_basis text,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists reviewed_by text;

comment on column framework_mappings.mapping_confidence is
  'How defensible the mapping is. high = direct, explicit; medium = strong supporting alignment; low = inferred / overlap-based.';
comment on column framework_mappings.interpretation_basis is
  'One sentence explaining why this control maps to this requirement (the answer to "why does Fortify say this satisfies HIPAA §X?").';

-- ─── 4. controls: weight + audience extension + automation_level + role
alter table controls
  add column if not exists default_weight numeric(3,2) not null default 1.0 check (default_weight >= 0.1 and default_weight <= 3.0),
  add column if not exists automation_level text check (automation_level in (
    'auto_verified',
    'partially_verified',
    'manual_evidence_required',
    'admin_attestation',
    'managed_review_required',
    'needs_integration'
  )),
  add column if not exists responsible_role text;

-- Widen audience to v2 vocabulary. customer kept as the default for
-- back-compat; new values added.
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'controls'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%audience%';
  if conname is not null then
    execute format('alter table controls drop constraint %I', conname);
  end if;
end $$;

alter table controls
  add constraint controls_audience_check
  check (audience in (
    'customer',
    'customer_practice',
    'fortify_internal',
    'vendor',
    'workforce',
    'admin',
    'integration',
    'managed_service'
  ));

comment on column controls.default_weight is
  'Risk weighting used by the readiness score. 0.1-3.0. Critical controls (MFA, audit logs, backups, exclusion screening) carry 1.5-2.0. Lower-risk documentation refinements carry 0.5-0.8.';
comment on column controls.automation_level is
  'Verification method label shown in the UI. Mirrors evidence_checks.automation_level for the typical primary check on the control.';
comment on column controls.responsible_role is
  'Who in a typical small healthcare practice owns this control. e.g. "Security Officer" / "Practice Manager" / "Office Administrator" / "Privacy Officer" / "IT Admin / MSP".';

-- ─── 5. remediation_guidance: playbook detail ──────────────────────────
alter table remediation_guidance
  add column if not exists framework_impact jsonb,
  add column if not exists responsible_role text,
  add column if not exists risk_level text check (risk_level in ('critical', 'high', 'medium', 'low')),
  add column if not exists evidence_after_remediation text,
  add column if not exists due_date_logic text,
  add column if not exists why_it_matters text;

comment on column remediation_guidance.framework_impact is
  'Which frameworks are impacted when this control fails. jsonb shape: {"HIPAA":["164.312(d)"],"SOC2":["CC6.1"],"ISO27001":["A.5.16"],"GDPR":["Art. 32(1)(b)"]}.';
comment on column remediation_guidance.why_it_matters is
  'One-sentence plain-language reason this control matters for a small healthcare practice — patient safety, breach exposure, OCR fine risk, operational impact.';
comment on column remediation_guidance.due_date_logic is
  'How to compute the due date for the generated task. e.g. "+7 days for critical" / "next quarterly review window" / "+24h" — interpreted by tasks.ts.';

-- ─── 6. Helpful indexes for the v2 query paths ────────────────────────
create index if not exists idx_controls_default_weight on controls(default_weight desc);
create index if not exists idx_controls_automation_level on controls(automation_level);
create index if not exists idx_framework_mappings_confidence
  on framework_mappings(control_id, mapping_confidence);
create index if not exists idx_evidence_checks_automation_level
  on evidence_checks(automation_level);
