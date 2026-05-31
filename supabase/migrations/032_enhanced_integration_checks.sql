-- 032_enhanced_integration_checks.sql
-- Seed 15+ new evidence_checks across the four official integrations
-- (M365, Google, AWS, Okta) plus the new DocuSign integration. Each
-- check is mapped to an existing control in the library so it
-- automatically produces evidence + findings + tasks + audit-log
-- entries via the unified evidence flow.

do $$
declare
  -- Existing controls in the library (016, 026)
  c_acc_001 uuid := (select id from controls where control_key = 'ACC-001');  -- admin MFA
  c_acc_002 uuid := (select id from controls where control_key = 'ACC-002');  -- workforce MFA
  c_acc_003 uuid := (select id from controls where control_key = 'ACC-003');  -- unique accounts
  c_acc_004 uuid := (select id from controls where control_key = 'ACC-004');  -- access review
  c_acc_005 uuid := (select id from controls where control_key = 'ACC-005');  -- offboarding
  c_acc_006 uuid := (select id from controls where control_key = 'ACC-006');  -- password policy
  c_log_001 uuid := (select id from controls where control_key = 'LOG-001');  -- audit log
  c_cry_001 uuid := (select id from controls where control_key = 'CRY-001');  -- encryption at rest
  c_cry_002 uuid := (select id from controls where control_key = 'CRY-002');  -- encryption in transit
  c_pol_001 uuid := (select id from controls where control_key = 'POL-001');  -- ISP
  c_ven_001 uuid := (select id from controls where control_key = 'VEN-001');  -- BAA
  c_dev_002 uuid := (select id from controls where control_key = 'DEV-002');  -- anti-malware
begin
  -- ── M365 ENHANCEMENTS ─────────────────────────────────────────────
  if c_acc_005 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
      (c_acc_005, 'm365_inactive_users',
       'M365 inactive users (90d)',
       'Flags any enabled M365 account with no sign-in in the configured window. Inactive accounts widen the attack surface and should be disabled or removed.',
       'automated_api', 'microsoft_365', 24,
       jsonb_build_object('max_days_since_signin', 90),
       jsonb_build_object('max_days_since_signin', 90))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_001, 'm365_risky_guest_users',
       'M365 guest accounts with admin role',
       'Guest users should not hold directory roles. Fails when any guest is assigned to an admin role.',
       'automated_api', 'microsoft_365', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_log_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_log_001, 'm365_mailbox_forwarding',
       'M365 external mailbox forwarding rules',
       'Surveys mailboxes for inbox rules that forward / redirect to external addresses — a classic data-exfil channel for ransomware crews.',
       'automated_api', 'microsoft_365', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_002 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_002, 'm365_security_defaults',
       'M365 / Entra security defaults enabled',
       'Microsoft security defaults provide baseline MFA + legacy-auth block for tenants without Conditional Access licensing. Passes when enabled.',
       'automated_api', 'microsoft_365', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  -- ── GOOGLE WORKSPACE ENHANCEMENTS ─────────────────────────────────
  if c_acc_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_001, 'google_admin_inventory',
       'Google Workspace admin inventory healthy',
       'Counts Super Admins. Healthy range is 1-5 — fewer is a single point of failure, more is privilege sprawl.',
       'automated_api', 'google_workspace', 24,
       jsonb_build_object('healthy_range', '1-5'))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_005 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
      (c_acc_005, 'google_inactive_users',
       'Google Workspace inactive users (90d)',
       'Flags active Google Workspace accounts with no login in the configured window.',
       'automated_api', 'google_workspace', 24,
       jsonb_build_object('max_days_since_login', 90),
       jsonb_build_object('max_days_since_login', 90))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_log_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_log_001, 'google_external_sharing',
       'Google Drive external sharing exposure',
       'Inspects recent Drive sharing events for anonymous (public link) or external shares. Anonymous shares fail.',
       'automated_api', 'google_workspace', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  -- ── AWS ENHANCEMENTS ──────────────────────────────────────────────
  if c_log_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_log_001, 'aws_guardduty_enabled',
       'AWS GuardDuty enabled in every region',
       'Verifies a GuardDuty detector exists and is ENABLED in every active region.',
       'automated_api', 'aws', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_cry_002 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_cry_002, 'aws_security_groups_open',
       'AWS security groups open to the internet',
       'Flags security groups allowing 0.0.0.0/0 inbound on ports other than 80/443.',
       'automated_api', 'aws', 24,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_006 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
      (c_acc_006, 'aws_unused_access_keys',
       'AWS unused IAM access keys (90d)',
       'Flags active IAM access keys not used in the configured window. Unused keys should be rotated or deleted.',
       'automated_api', 'aws', 24,
       jsonb_build_object('max_age_days', 90),
       jsonb_build_object('max_age_days', 90))
    on conflict (control_id, check_key) do nothing;
  end if;

  -- ── OKTA ENHANCEMENTS ─────────────────────────────────────────────
  if c_acc_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_001, 'okta_admin_role_inventory',
       'Okta admin role inventory healthy',
       'Counts users with Super Admin / Org Admin assignments. Healthy range is 1-5 super admins.',
       'automated_api', 'okta', 24,
       jsonb_build_object('healthy_range', '1-5'))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_005 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
      (c_acc_005, 'okta_inactive_users',
       'Okta inactive users (90d)',
       'Flags ACTIVE Okta users with no login in the configured window.',
       'automated_api', 'okta', 24,
       jsonb_build_object('max_days_since_login', 90),
       jsonb_build_object('max_days_since_login', 90))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_acc_006 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_acc_006, 'okta_password_policy',
       'Okta password policy meets NIST 800-63B',
       'Verifies the active password policy enforces minLength >= 12 with character-class requirements.',
       'automated_api', 'okta', 24,
       jsonb_build_object('min_length', 12))
    on conflict (control_id, check_key) do nothing;
  end if;

  -- ── DOCUSIGN ──────────────────────────────────────────────────────
  -- We map DocuSign to the policy (POL-001) and BAA (VEN-001) controls
  -- since its primary compliance value is signed compliance artifacts.
  if c_pol_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria) values
      (c_pol_001, 'docusign_account_accessible',
       'DocuSign account accessible',
       'Health-check: verifies the integration token is valid and the account row is queryable.',
       'automated_api', 'docusign', 24,
       jsonb_build_object('required', true)),
      (c_pol_001, 'docusign_signed_compliance_envelopes',
       'DocuSign signed compliance envelopes in last year',
       'Counts completed envelopes whose subject matches compliance patterns (policy / attestation / agreement) in the last 365 days.',
       'automated_api', 'docusign', 168,
       jsonb_build_object('required', true))
    on conflict (control_id, check_key) do nothing;
  end if;

  if c_ven_001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
      (c_ven_001, 'docusign_outstanding_envelopes',
       'DocuSign outstanding BAA / compliance envelopes',
       'Flags compliance envelopes sent more than 30 days ago and still awaiting signature.',
       'automated_api', 'docusign', 24,
       jsonb_build_object('max_age_days', 30),
       jsonb_build_object('max_age_days', 30))
    on conflict (control_id, check_key) do nothing;
  end if;
end $$;
