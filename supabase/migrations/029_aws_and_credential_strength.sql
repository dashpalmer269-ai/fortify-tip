-- 029_aws_and_credential_strength.sql
-- Adds the AWS integration evidence checks (5) and the new credential-strength
-- control (SEC-001) + its internal-DB check. Together these give the practice
-- continuous monitoring of:
--   - CloudTrail multi-region logging
--   - root account MFA
--   - IAM user MFA
--   - S3 public access exposure
--   - S3 default encryption
-- AND a rolled-up credential-health signal that grades every connected
-- integration on encryption, type, age, and scope (0-100 score).

-- ── A. New control: SEC-001 Integration credentials securely stored ───
insert into controls (
  control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active,
  healthcare_category, audience, automation_status, evidence_summary, remediation_guide, report_output_text
) values (
  'SEC-001',
  'Integration credentials encrypted and rotated',
  'Every connected integration (M365, Google, Okta, AWS, etc.) stores credentials encrypted via the KMS-backed helper, with rotation cadence appropriate to the credential type. The credential-strength score across encryption, type, age, and scope must remain above the configured threshold for every integration.',
  'cryptography', 'technical', 'high', true, true,
  'data_protection', 'customer', 'fully_automated',
  'Fortify scores every connected integration on encryption, credential type, sync age, and scope. Pass requires every integration score >= 60.',
  $$1. Open Fortify -> Integrations
2. For any integration flagged below threshold:
   - If "no encrypted credentials": disconnect and reconnect (the new connection will be sealed via the KMS helper)
   - If "stale credentials": rotate the API key / re-run OAuth on that integration
   - If "broad write/admin scopes": re-issue with read-only scope where possible
3. Re-run the verify-compliance check — the score should clear within 24 hours$$,
  'Practice maintains continuous monitoring of integration credential strength, with all integrations scoring above the security threshold.'
) on conflict (control_key) do nothing;

-- ── B. Wire SEC-001 to existing framework_requirements ────────────────
do $$
declare
  c_sec_001 uuid := (select id from controls where control_key = 'SEC-001');
  r_h_encrypt    uuid := (select id from framework_requirements where citation = '164.312(a)(2)(iv)');
  r_h_access     uuid := (select id from framework_requirements where citation = '164.312(a)(1)');
  r_s_cc61       uuid := (select id from framework_requirements where citation = 'CC6.1');
  r_i_a516       uuid := (select id from framework_requirements where citation = 'A.5.16');
  r_i_a824       uuid := (select id from framework_requirements where citation = 'A.8.24');
  r_g_32a        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(a)');
  r_g_32b        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(b)');
begin
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (c_sec_001, r_h_encrypt, 'fully_satisfies'),
    (c_sec_001, r_h_access,  'partially_satisfies'),
    (c_sec_001, r_s_cc61,    'fully_satisfies'),
    (c_sec_001, r_i_a516,    'fully_satisfies'),
    (c_sec_001, r_i_a824,    'fully_satisfies'),
    (c_sec_001, r_g_32a,     'fully_satisfies'),
    (c_sec_001, r_g_32b,     'fully_satisfies')
  on conflict (control_id, framework_requirement_id) do nothing;
end $$;

-- ── C. Evidence check for SEC-001 (internal DB query) ────────────────
do $$
declare
  c_sec_001 uuid := (select id from controls where control_key = 'SEC-001');
begin
  insert into evidence_checks (
    control_id, check_key, title, description,
    collection_method, source_integration, frequency_hours,
    check_config, pass_criteria
  ) values (
    c_sec_001,
    'integration_credential_strength',
    'Integration credential strength score',
    'Scores every connected integration on encryption (40), credential type (25), age (20), scope (15) and fails if any integration is below the configured threshold.',
    'automated_db_query', null, 12,
    jsonb_build_object('min_score', 60),
    jsonb_build_object('min_score', 60)
  ) on conflict (control_id, check_key) do nothing;
end $$;

-- ── D. AWS evidence checks (5) ────────────────────────────────────────
do $$
declare
  -- Existing controls to map to (created in 016 / 026)
  c_log_001 uuid := (select id from controls where control_key = 'LOG-001');  -- audit log
  c_acc_001 uuid := (select id from controls where control_key = 'ACC-001');  -- admin MFA
  c_acc_002 uuid := (select id from controls where control_key = 'ACC-002');  -- workforce MFA
  c_cry_001 uuid := (select id from controls where control_key = 'CRY-001');  -- encryption at rest
begin
  if c_log_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_log_001, 'aws_cloudtrail_multi_region', 'AWS CloudTrail multi-region logging active',
       'Confirms at least one multi-region CloudTrail trail exists and is actively logging.',
       'automated_api', 'aws', 24, '{"required": true}'::jsonb)
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_001, 'aws_iam_root_mfa', 'AWS root account MFA enforced',
       'Confirms AccountMFAEnabled = 1 via IAM GetAccountSummary.',
       'automated_api', 'aws', 24, '{"required": true}'::jsonb)
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_002 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_002, 'aws_iam_user_mfa_enforced', 'AWS IAM users have MFA devices',
       'Confirms every IAM user has at least one MFA device enrolled.',
       'automated_api', 'aws', 24, '{"required": true}'::jsonb)
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_cry_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_cry_001, 'aws_s3_no_public_buckets', 'No S3 buckets readable by the public',
       'Verifies no bucket has policy_status.IsPublic=true or AllUsers ACL grant.',
       'automated_api', 'aws', 24, '{"required": true}'::jsonb),
      (c_cry_001, 'aws_s3_default_encryption', 'S3 buckets have default encryption configured',
       'Verifies every S3 bucket has at least one ServerSideEncryptionConfiguration rule.',
       'automated_api', 'aws', 24, '{"required": true}'::jsonb)
    on conflict (control_id, check_key) do nothing;
  end if;
end $$;
