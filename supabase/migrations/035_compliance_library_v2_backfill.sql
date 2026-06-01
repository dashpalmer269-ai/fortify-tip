-- 035_compliance_library_v2_backfill.sql
-- Populate the v2 columns on every existing row so the UI + scoring don't
-- have to special-case NULLs. Pure data, no schema changes.

-- ─── controls: derive automation_level from existing automation_status,
--               set default_weight by category, set responsible_role,
--               normalize audience to v2 vocabulary
update controls set
  automation_level = case automation_status
    when 'fully_automated'   then 'auto_verified'
    when 'semi_automated'    then 'partially_verified'
    when 'document_upload'   then 'manual_evidence_required'
    when 'manual_attestation' then 'admin_attestation'
    else                          'managed_review_required'
  end
where automation_level is null;

-- Default weight by category — critical control families get higher weight
update controls set default_weight = case
  -- Critical: 2.0
  when healthcare_category in ('mfa_identity', 'exclusion_screening', 'breach_notification') then 2.0
  when control_key in ('BCK-001','BCK-002','BCK-004','LOG-001','LOG-002','RSK-001','INC-001','INC-002','ACC-005','VEN-001') then 2.0
  -- High: 1.5
  when healthcare_category in ('employee_access','audit_logs','backup_disaster_recovery','incident_response','risk_assessments','vendor_baa_management','data_protection','device_security') then 1.5
  -- Medium baseline: 1.0
  when healthcare_category in ('hipaa_training','policy_acknowledgments','change_management','integration_credentials','physical_safeguards') then 1.0
  else 1.0
end
where default_weight = 1.0;  -- only touch unset rows

-- Responsible role — a typical small healthcare practice org chart
update controls set responsible_role = case healthcare_category
  when 'mfa_identity'             then 'IT Admin / MSP'
  when 'employee_access'          then 'Practice Manager'
  when 'hipaa_training'           then 'Privacy Officer'
  when 'policy_acknowledgments'   then 'Practice Manager'
  when 'vendor_baa_management'    then 'Privacy Officer'
  when 'backup_disaster_recovery' then 'IT Admin / MSP'
  when 'audit_logs'               then 'Security Officer'
  when 'device_security'          then 'IT Admin / MSP'
  when 'exclusion_screening'      then 'HR / Practice Manager'
  when 'risk_assessments'         then 'Security Officer'
  when 'incident_response'        then 'Security Officer'
  when 'physical_safeguards'      then 'Office Manager'
  when 'data_protection'          then 'Security Officer'
  when 'change_management'        then 'IT Admin / MSP'
  when 'breach_notification'      then 'Privacy Officer'
  when 'integration_credentials'  then 'IT Admin / MSP'
  else 'Practice Manager'
end
where responsible_role is null;

-- Normalize audience: customer → customer_practice
update controls set audience = 'customer_practice'
where audience = 'customer';

-- ─── evidence_checks: backfill automation_level from collection_method
update evidence_checks set automation_level = case collection_method
  when 'automated_api'      then 'auto_verified'
  when 'automated_db_query' then 'auto_verified'
  when 'automated_scan'     then 'auto_verified'
  when 'manual_attestation' then 'admin_attestation'
  when 'document_upload'    then 'manual_evidence_required'
  when 'screenshot'         then 'manual_evidence_required'
  else                           'managed_review_required'
end
where automation_level is null;

-- Default satisfaction rule per automation_level — the runner consults this
-- as a fallback when the per-check observed_value doesn't carry a status.
update evidence_checks set satisfaction_rule = case automation_level
  when 'auto_verified' then jsonb_build_object(
    'any_of', jsonb_build_array(
      jsonb_build_object('source', 'integration', 'status', 'pass')
    )
  )
  when 'partially_verified' then jsonb_build_object(
    'any_of', jsonb_build_array(
      jsonb_build_object('source', 'integration', 'status', 'pass'),
      jsonb_build_object('source', 'attestation', 'age_days_lte', 90)
    )
  )
  when 'manual_evidence_required' then jsonb_build_object(
    'any_of', jsonb_build_array(
      jsonb_build_object('source', 'document_upload', 'age_days_lte', coalesce((check_config->>'max_age_days')::int, 365))
    )
  )
  when 'admin_attestation' then jsonb_build_object(
    'any_of', jsonb_build_array(
      jsonb_build_object('source', 'attestation', 'age_days_lte', coalesce((pass_criteria->>'value')::int, 90))
    )
  )
  else null
end
where satisfaction_rule is null;

-- Manual upload / attestation acceptability defaults
update evidence_checks set
  manual_upload_allowed = case
    when collection_method = 'automated_api' then false
    else true
  end,
  attestation_acceptable = case
    when collection_method in ('automated_api','automated_db_query','automated_scan') then false
    when collection_method = 'manual_attestation' then true
    when collection_method = 'document_upload' then false  -- document is the proof, not the attestation
    else true
  end
where evidence_required = true;  -- harmless safety filter

-- ─── framework_requirements: source provenance backfill
update framework_requirements set source_type = case
  -- HIPAA citations are CFR regulations under 45 CFR Parts 160 & 164
  when citation like '164.%' then 'regulation'
  -- SOC 2 is AICPA Trust Services Criteria (standard)
  when citation like 'CC%' or citation like 'A%' or citation like 'C%' or citation like 'PI%' or citation like 'P%' then 'standard'
  -- ISO 27001:2022 Annex A is an international standard
  when citation like 'A.%' then 'standard'
  -- GDPR is EU regulation
  when citation like 'Art.%' then 'regulation'
  else 'standard'
end
where source_type is null;

update framework_requirements set last_reviewed_at = now(), reviewed_by = 'Fortify content team — initial v2 review'
where last_reviewed_at is null;

-- Add a baseline source_url for major citations missing one
update framework_requirements set source_url = case
  when citation like '164.30%' or citation like '164.31%' or citation like '164.5%' then 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164'
  when citation like '164.40%' then 'https://www.hhs.gov/hipaa/for-professionals/breach-notification/'
  when citation like 'CC%' or citation like 'A1%' or citation like 'C1%' or citation like 'PI1%' or citation like 'P1%' then 'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'
  when citation like 'A.%' then 'https://www.iso.org/standard/27001'
  when citation like 'Art.%' then 'https://gdpr-info.eu/'
  else source_url
end
where source_url is null;

-- ─── framework_mappings: confidence defaults + interpretation_basis
update framework_mappings set mapping_confidence = case mapping_strength
  when 'fully_satisfies'     then 'high'
  when 'partially_satisfies' then 'medium'
  when 'contributes_to'      then 'low'
  else 'medium'
end
where mapping_confidence is null or mapping_confidence = 'high';  -- only touch defaults

update framework_mappings set last_reviewed_at = now()
where last_reviewed_at is null;

-- ─── remediation_guidance: backfill v2 fields where rows already exist
update remediation_guidance set risk_level = severity
where risk_level is null and severity is not null;

update remediation_guidance set responsible_role = 'Practice Manager'
where responsible_role is null;

update remediation_guidance set why_it_matters = title
where why_it_matters is null;

update remediation_guidance set due_date_logic = case severity
  when 'critical' then '+7 days from task creation'
  when 'high'     then '+14 days from task creation'
  when 'medium'   then '+30 days from task creation'
  else                 '+60 days from task creation'
end
where due_date_logic is null;
