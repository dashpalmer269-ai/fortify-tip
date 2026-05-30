-- 024_operational_controls_schema.sql
-- Make the control library operational, not informational.
--
-- For every control we want to answer five questions inline:
--   1. WHAT must the practice actually do?              -> title + description (existing)
--   2. WHAT proves it's done?                           -> evidence_summary (new)
--   3. HOW does Fortify check it?                       -> automation_status (new)
--   4. WHO owns it — customer or Fortify?               -> audience (new)
--   5. HOW does the practice fix a failure?             -> remediation_guide (new)
-- Plus: what sentence does the attestation report print?  -> report_output_text (new)
-- And:  which healthcare-workflow bucket does it live in? -> healthcare_category (new)
--
-- The existing `category` column stays (cryptography/audit_logging/etc — a
-- security taxonomy). `healthcare_category` is a parallel axis that matches
-- how a medical practice actually organizes its compliance work
-- (Employee Access, MFA & Identity, HIPAA Training, etc.). Both axes are
-- useful — the security one for engineers, the healthcare one for the
-- people doing the work.

alter table controls
  add column if not exists healthcare_category text check (healthcare_category in (
    'employee_access',
    'mfa_identity',
    'hipaa_training',
    'policy_acknowledgments',
    'vendor_baa_management',
    'backup_disaster_recovery',
    'audit_logs',
    'device_security',
    'exclusion_screening',
    'risk_assessments',
    'incident_response',
    'physical_safeguards',
    'data_protection',
    'change_management',
    'breach_notification'
  )),
  add column if not exists audience text not null default 'customer' check (audience in (
    'customer',          -- the practice owns this control
    'fortify_internal'   -- Fortify (the platform) owns this; surfaced as proof to the practice
  )),
  add column if not exists automation_status text check (automation_status in (
    'fully_automated',   -- Fortify scans an integration and decides pass/fail
    'semi_automated',    -- Fortify pulls signal but a human confirms
    'document_upload',   -- practice uploads a document; Fortify checks recency
    'manual_attestation' -- practice attests; Fortify checks renewal cadence
  )),
  add column if not exists evidence_summary text,           -- one line: what proves this
  add column if not exists remediation_guide text,          -- markdown, practice-friendly
  add column if not exists report_output_text text;         -- the attestation/report sentence

create index if not exists idx_controls_healthcare_category on controls(healthcare_category);
create index if not exists idx_controls_audience on controls(audience);

comment on column controls.healthcare_category is
  'Healthcare-workflow bucket for operational organization (Employee Access, MFA & Identity, HIPAA Training, etc.). Parallel to security taxonomy in `category`.';
comment on column controls.audience is
  'Owner of the control: `customer` = the practice must do it; `fortify_internal` = Fortify the platform does it, surfaced as proof.';
comment on column controls.automation_status is
  'How Fortify verifies: fully_automated (integration scan) | semi_automated (signal + human confirm) | document_upload (recency check) | manual_attestation (renewal cadence).';
comment on column controls.evidence_summary is
  'One-sentence answer to "what proves this is done?" — shown in dashboards.';
comment on column controls.remediation_guide is
  'Practice-friendly markdown step-by-step for fixing a failure. Surfaced inline on the punch list.';
comment on column controls.report_output_text is
  'The exact sentence the attestation/report prints when this control is compliant.';
