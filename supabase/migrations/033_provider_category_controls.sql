-- 033_provider_category_controls.sql
-- New controls for the four new provider categories. Each starts as
-- manual_attestation so a practice can attest today; as we ship real
-- API clients per-provider (Datto, Acronis, Athenahealth, NinjaOne,
-- DocuSign — already shipped — etc), those checks upgrade to
-- automated_api without code changes downstream.

-- ── New controls ─────────────────────────────────────────────────────
insert into controls (
  control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active,
  healthcare_category, audience, automation_status, evidence_summary, remediation_guide, report_output_text
) values

('BCK-006',
 'Backup provider produces verified successful runs',
 'The practice''s backup provider (Datto, Acronis, Cove/N-able, Veeam, Azure Backup, or equivalent) produces successful daily runs, alerts on failure, and retains evidence Fortify can verify on a schedule.',
 'continuity', 'technical', 'critical', true, true,
 'backup_disaster_recovery', 'customer', 'manual_attestation',
 'Backup vendor evidence (last successful run timestamp + failure alert configuration) attested every 90 days OR pulled automatically once the provider''s API client ships.',
 $$1. Identify the backup provider in use (EHR-side or self-managed)
2. In Fortify -> Integrations -> Backup, attest with: provider name, last successful run date, failure-alert recipient
3. If your provider is supported (Datto, Acronis, Cove, Veeam, Azure Backup), connect it for automated checks
4. If failure alerts are not configured, configure them — backup silence is a risk$$,
 'Practice backup provider produces verified successful runs with failure alerting in place.'
),

('EHR-001',
 'EHR / Practice Management vendor risk posture maintained',
 'The clinical EHR / Practice Management system in use has: (a) a current BAA on file, (b) administrative access reviewed at least quarterly, (c) audit-log availability confirmed with the vendor, (d) a documented user lifecycle process for onboarding / offboarding. Fortify never stores or pulls PHI from these systems — only metadata.',
 'vendor', 'administrative', 'high', true, true,
 'vendor_baa_management', 'customer', 'manual_attestation',
 'EHR vendor row in Fortify with BAA status + last admin-review date + audit-log availability attestation, refreshed quarterly.',
 $$1. Identify the EHR / Practice Management system (Athenahealth, AdvancedMD, Dentrix, Kareo/Tebra, DrChrono, or other)
2. Open Fortify -> Integrations -> EHR / PMS — declare which one you use
3. Confirm and upload: signed BAA, list of admin users with the EHR, latest quarterly access review, vendor-supplied audit log availability statement
4. Fortify does NOT store clinical data — these checks track the surrounding compliance evidence only$$,
 'Practice maintains BAA, admin access review, and audit-log availability evidence for its EHR / Practice Management vendor.'
),

('MSP-001',
 'RMM / MSP tooling produces device evidence on schedule',
 'Where the practice uses an RMM (NinjaOne, ConnectWise Automate, Datto RMM, Atera, Syncro, N-able) or an MSP-managed environment, Fortify ingests or attests device inventory, patch status, anti-malware coverage, encryption status, and last check-in. Drift triggers a remediation task.',
 'identity', 'technical', 'high', true, true,
 'device_security', 'customer', 'manual_attestation',
 'Most recent RMM / MSP attestation on file (device count, patched %, encrypted %, last check-in) refreshed every 30 days, OR automated pull via supported RMM API.',
 $$1. Identify the RMM tool in use (or "MSP-managed only — no direct RMM access")
2. Open Fortify -> Integrations -> RMM / MSP — declare provider + cadence
3. Attest the current device count, patch compliance %, encryption coverage %, and oldest device last check-in
4. If your RMM is supported, connect it for automatic evidence collection$$,
 'Practice maintains current device inventory, patch status, anti-malware coverage, and encryption evidence via its RMM / MSP tooling.'
),

('SIG-001',
 'Compliance artifacts captured via electronic signature platform',
 'Where electronic signature is used for compliance artifacts (policies, BAAs, workforce attestations, training records), the platform (DocuSign, Dropbox Sign, or equivalent) is integrated and produces a verifiable trail of signed envelopes that map to Fortify''s evidence model.',
 'policy', 'administrative', 'medium', true, true,
 'policy_acknowledgments', 'customer', 'semi_automated',
 'DocuSign / Dropbox Sign integration shows signed compliance envelopes in the last 365 days, with no stale outstanding signatures past the 30-day SLA.',
 $$1. Connect DocuSign (or equivalent) under Fortify -> Integrations -> E-signature
2. For each compliance artifact, send via the integrated platform so the completion is captured as evidence
3. Use compliance-style subject lines (e.g. "HIPAA Information Security Policy v3 acknowledgement") so the envelope-scanning runner picks them up
4. Chase any envelope outstanding more than 30 days$$,
 'Practice captures compliance artifacts (policies, BAAs, attestations) via an integrated electronic signature platform with a verifiable trail.'
),

('TSK-001',
 'Remediation tasks tracked in a verifiable task system',
 'Where the practice uses a dedicated task tracker (Jira, Linear, Asana, Trello) for security / compliance remediation work, Fortify can sync the work-item state so audit-prep tasks show consistent status across systems.',
 'change_management', 'administrative', 'low', true, true,
 'change_management', 'customer', 'manual_attestation',
 'Task tracker (Jira / Linear / Asana / Trello) attested in use OR connected; remediation work synced.',
 $$1. Decide whether to track compliance remediation inside Fortify (default) or in an external tracker
2. If external: open Fortify -> Integrations -> Task tracker; declare the tool
3. For now, attest quarterly that compliance work is being tracked in that system
4. Automated 2-way sync ships per-provider as the connector is built$$,
 'Practice tracks remediation and audit-prep work in a designated task system with attested cadence.'
)

on conflict (control_key) do nothing;

-- ── Framework mappings for the new controls ─────────────────────────
do $$
declare
  c_bck_006 uuid := (select id from controls where control_key = 'BCK-006');
  c_ehr_001 uuid := (select id from controls where control_key = 'EHR-001');
  c_msp_001 uuid := (select id from controls where control_key = 'MSP-001');
  c_sig_001 uuid := (select id from controls where control_key = 'SIG-001');
  c_tsk_001 uuid := (select id from controls where control_key = 'TSK-001');

  r_h_continq   uuid := (select id from framework_requirements where citation = '164.308(a)(7)(i)');
  r_h_workforce uuid := (select id from framework_requirements where citation = '164.308(a)(3)(i)');
  r_h_train     uuid := (select id from framework_requirements where citation = '164.308(a)(5)(i)');
  r_h_eval      uuid := (select id from framework_requirements where citation = '164.308(a)(8)');
  r_h_ba        uuid := (select id from framework_requirements where citation = '164.308(b)(1)');
  r_h_access    uuid := (select id from framework_requirements where citation = '164.312(a)(1)');
  r_h_dev_media uuid := (select id from framework_requirements where citation = '164.310(d)(1)');
  r_h_encrypt   uuid := (select id from framework_requirements where citation = '164.312(a)(2)(iv)');

  r_s_cc61      uuid := (select id from framework_requirements where citation = 'CC6.1');
  r_s_cc71      uuid := (select id from framework_requirements where citation = 'CC7.1');
  r_s_cc81      uuid := (select id from framework_requirements where citation = 'CC8.1');
  r_s_cc91      uuid := (select id from framework_requirements where citation = 'CC9.1');

  r_i_a530      uuid := (select id from framework_requirements where citation = 'A.5.30');
  r_i_a519      uuid := (select id from framework_requirements where citation = 'A.5.19');
  r_i_a813      uuid := (select id from framework_requirements where citation = 'A.8.13');
  r_i_a832      uuid := (select id from framework_requirements where citation = 'A.8.32');

  r_g_32c       uuid := (select id from framework_requirements where citation = 'Art. 32(1)(c)');
  r_g_32d       uuid := (select id from framework_requirements where citation = 'Art. 32(1)(d)');
begin
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    -- BCK-006: backup verified
    (c_bck_006, r_h_continq, 'fully_satisfies'),
    (c_bck_006, r_s_cc71,    'fully_satisfies'),
    (c_bck_006, r_i_a813,    'fully_satisfies'),
    (c_bck_006, r_i_a530,    'fully_satisfies'),
    (c_bck_006, r_g_32c,     'fully_satisfies'),

    -- EHR-001: EHR vendor posture
    (c_ehr_001, r_h_ba,         'fully_satisfies'),
    (c_ehr_001, r_h_workforce,  'partially_satisfies'),
    (c_ehr_001, r_h_eval,       'partially_satisfies'),
    (c_ehr_001, r_s_cc91,       'fully_satisfies'),
    (c_ehr_001, r_i_a519,       'fully_satisfies'),
    (c_ehr_001, r_g_32d,        'fully_satisfies'),

    -- MSP-001: RMM device evidence
    (c_msp_001, r_h_access,    'fully_satisfies'),
    (c_msp_001, r_h_dev_media, 'fully_satisfies'),
    (c_msp_001, r_h_encrypt,   'partially_satisfies'),
    (c_msp_001, r_s_cc61,      'fully_satisfies'),
    (c_msp_001, r_s_cc71,      'partially_satisfies'),

    -- SIG-001: signed compliance artifacts
    (c_sig_001, r_h_train,    'partially_satisfies'),
    (c_sig_001, r_h_ba,       'partially_satisfies'),
    (c_sig_001, r_s_cc81,     'partially_satisfies'),

    -- TSK-001: task tracker
    (c_tsk_001, r_s_cc81,     'partially_satisfies'),
    (c_tsk_001, r_i_a832,     'partially_satisfies')
  on conflict (control_id, framework_requirement_id) do nothing;
end $$;

-- ── Evidence checks (manual_attestation seed; auto-upgrade later) ───
do $$
declare
  c_bck_006 uuid := (select id from controls where control_key = 'BCK-006');
  c_ehr_001 uuid := (select id from controls where control_key = 'EHR-001');
  c_msp_001 uuid := (select id from controls where control_key = 'MSP-001');
  c_sig_001 uuid := (select id from controls where control_key = 'SIG-001');
  c_tsk_001 uuid := (select id from controls where control_key = 'TSK-001');
begin
  insert into evidence_checks (control_id, check_key, title, description, collection_method, frequency_hours, check_config, pass_criteria) values
    (c_bck_006, 'bck_006_attestation', 'Backup provider attestation', 'Quarterly attestation that the backup provider produced a verified successful run and that failure alerting is configured.', 'manual_attestation', 24, jsonb_build_object('max_age_days', 90), jsonb_build_object('value', 90)),
    (c_ehr_001, 'ehr_001_attestation', 'EHR / PMS vendor attestation', 'Quarterly attestation covering BAA status, admin access review, and audit-log availability with the EHR vendor.', 'manual_attestation', 24, jsonb_build_object('max_age_days', 90), jsonb_build_object('value', 90)),
    (c_msp_001, 'msp_001_attestation', 'RMM / MSP device evidence attestation', 'Monthly attestation of device inventory, patch %, encryption %, last check-in.', 'manual_attestation', 24, jsonb_build_object('max_age_days', 30), jsonb_build_object('value', 30)),
    (c_sig_001, 'sig_001_attestation', 'E-signature platform attestation', 'Quarterly attestation that compliance artifacts use the integrated e-signature platform.', 'manual_attestation', 24, jsonb_build_object('max_age_days', 90), jsonb_build_object('value', 90)),
    (c_tsk_001, 'tsk_001_attestation', 'Task tracker attestation', 'Quarterly attestation that compliance / audit work is tracked in a designated task system.', 'manual_attestation', 24, jsonb_build_object('max_age_days', 90), jsonb_build_object('value', 90))
  on conflict (control_id, check_key) do nothing;
end $$;
