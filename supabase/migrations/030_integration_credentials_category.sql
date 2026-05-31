-- 030_integration_credentials_category.sql
-- Adds 'integration_credentials' as a healthcare-workflow category and
-- retags SEC-001 to live under it. This gives the practice a dedicated
-- bucket on /app/compliance for integration cybersecurity controls —
-- separate from 'data_protection' (which covers the broader cryptography
-- + tenant isolation surface).

-- 1. Widen the check constraint to include the new value
alter table controls
  drop constraint if exists controls_healthcare_category_check;

alter table controls
  add constraint controls_healthcare_category_check
  check (healthcare_category in (
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
    'breach_notification',
    'integration_credentials'
  ));

-- 2. Retag SEC-001 — it was sitting under data_protection as a placeholder
update controls
set healthcare_category = 'integration_credentials'
where control_key = 'SEC-001';
