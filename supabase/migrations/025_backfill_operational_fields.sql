-- 025_backfill_operational_fields.sql
-- Backfill the new operational columns on every existing control so the whole
-- library speaks the same five-piece language: healthcare_category, audience,
-- automation_status, evidence_summary, remediation_guide, report_output_text.
--
-- Also adds the small set of `audience='fortify_internal'` controls — the
-- platform-side guarantees Fortify provides to every practice (KMS-backed
-- credential encryption, append-only logging, TLS hardening, SOC 2 posture).
-- These never become customer punch-list tasks; they surface in attestations
-- as "Fortify maintains X on your behalf."

-- ── A. Backfill the 32 existing controls from 016_seed_control_library ────

-- ACC-001 MFA enforced for admin accounts
update controls set
  healthcare_category = 'mfa_identity',
  automation_status = 'fully_automated',
  evidence_summary = 'Microsoft 365 / Google Workspace / Okta scan confirms every admin account has MFA enrolled and required.',
  remediation_guide = $$
**Microsoft 365**
1. Go to Microsoft 365 Admin Center → Users → Active Users
2. For each admin account, click the user → Authentication methods → require MFA
3. Or apply a Conditional Access policy targeting "Directory roles: Global administrator" requiring MFA

**Google Workspace**
1. Admin Console → Security → Authentication → 2-step verification
2. Set "Enforcement" to "On" for the admin organizational unit

**Okta**
1. Security → Authenticators → enable a strong factor (WebAuthn, Okta Verify push)
2. Security → Authentication Policies → admin-only policy requires the strong factor

Re-run the verify-compliance check after — the failure should clear within 24 hours.
$$,
  report_output_text = 'Practice enforces multi-factor authentication for all administrative accounts.'
where control_key = 'ACC-001';

-- ACC-002 MFA enforced for all workforce accounts
update controls set
  healthcare_category = 'mfa_identity',
  automation_status = 'fully_automated',
  evidence_summary = 'Identity-provider scan shows ≥95% workforce MFA enrollment with Conditional Access enforcing MFA on sign-in.',
  remediation_guide = $$
1. Identity Admin Console → Security → require MFA for the all-staff organizational unit
2. For Microsoft 365: create a Conditional Access policy: "All users" → "All cloud apps" → require MFA
3. Email anyone not yet enrolled with their setup link
4. Monitor enrollment for 14 days; escalate stragglers to their manager
$$,
  report_output_text = 'Practice enforces multi-factor authentication for all workforce accounts handling clinical or compliance data.'
where control_key = 'ACC-002';

-- ACC-003 Unique account per workforce member
update controls set
  healthcare_category = 'employee_access',
  automation_status = 'semi_automated',
  evidence_summary = 'Workforce roster cross-referenced with identity-provider user list — no shared logins, every member maps to one account.',
  remediation_guide = $$
1. Pull the user list from your identity provider (M365 / Google / Okta)
2. Identify any shared mailbox or "front desk" account being used for sign-in
3. Provision an individual account for each user of the shared account
4. Disable the shared sign-in (a shared mailbox is fine; shared sign-in is not)
5. Update training so staff knows to never share credentials
$$,
  report_output_text = 'Practice maintains unique user identification for every workforce member with system access.'
where control_key = 'ACC-003';

-- ACC-004 Access review every 90 days
update controls set
  healthcare_category = 'employee_access',
  automation_status = 'manual_attestation',
  evidence_summary = 'Signed quarterly access-review attestation on file dated within the last 90 days.',
  remediation_guide = $$
1. Open Fortify → Team → Access Review
2. For each active member, confirm role is still correct and access is still needed
3. Remove or downgrade any access that is no longer needed
4. Click "Attest review complete" — the timestamped attestation goes to the audit log
$$,
  report_output_text = 'Practice performs and documents a workforce access review at least every 90 days.'
where control_key = 'ACC-004';

-- ACC-005 Offboarding within 24 hours
update controls set
  healthcare_category = 'employee_access',
  automation_status = 'semi_automated',
  evidence_summary = 'Audit log shows every workforce removal completed within 24 hours of separation notice.',
  remediation_guide = $$
1. When notified of separation, immediately open Fortify → Team → the departing user
2. Click "Remove access" — this triggers identity-provider deprovisioning if connected
3. Manually disable in M365 / Google / Okta if not connected
4. Forward email + confirm device returned within 24 hours
5. The action is recorded in the audit log with timestamp
$$,
  report_output_text = 'Practice revokes workforce access within 24 hours of separation or role change.'
where control_key = 'ACC-005';

-- ACC-006 Strong password requirements
update controls set
  healthcare_category = 'mfa_identity',
  automation_status = 'fully_automated',
  evidence_summary = 'Identity-provider policy: minimum length ≥12, breach-corpus screening enabled, no calendar rotation.',
  remediation_guide = $$
Align with NIST SP 800-63B:
1. Set minimum password length to 12 characters
2. Enable Microsoft / Google breached-password protection (or equivalent)
3. **Remove** calendar-based rotation requirements — they hurt security
4. Keep rotation triggered only by detected compromise
$$,
  report_output_text = 'Practice enforces password requirements consistent with NIST SP 800-63B guidance.'
where control_key = 'ACC-006';

-- CRY-001 Data encrypted at rest
update controls set
  healthcare_category = 'data_protection',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'Fortify storage is AES-256 encrypted at rest by Supabase/Postgres + S3 server-side encryption.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'All practice data within Fortify is encrypted at rest using AES-256.'
where control_key = 'CRY-001';

-- CRY-002 Data encrypted in transit
update controls set
  healthcare_category = 'data_protection',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'All Fortify endpoints enforce TLS 1.2+; HSTS enabled; HTTP plaintext disabled.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'All connections to Fortify are encrypted in transit using TLS 1.2 or higher with HSTS enforcement.'
where control_key = 'CRY-002';

-- CRY-003 Integration credentials encrypted with separate key
update controls set
  healthcare_category = 'data_protection',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'OAuth tokens / API keys stored as bytea ciphertext, sealed with CREDENTIAL_KMS_KEY held outside the database.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'Practice integration credentials are encrypted by Fortify with a key held outside the database.'
where control_key = 'CRY-003';

-- LOG-001 Append-only audit log of privileged actions
update controls set
  healthcare_category = 'audit_logs',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'audit_logs table is append-only at the RLS layer; every privileged write logs author, timestamp, resource.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'Fortify maintains an append-only audit log of every privileged action on the practice workspace.'
where control_key = 'LOG-001';

-- LOG-002 Audit log retention 12+ months (6 years for healthcare)
update controls set
  healthcare_category = 'audit_logs',
  automation_status = 'fully_automated',
  evidence_summary = 'audit_logs retention configured for ≥6 years to meet HIPAA documentation requirements.',
  remediation_guide = 'Fortify-managed. The practice may export logs at any time from Fortify → Audit → Export.',
  report_output_text = 'Practice retains audit log records for at least six years in compliance with HIPAA documentation requirements.'
where control_key = 'LOG-002';

-- LOG-003 Tamper-evident integrity on audit records
update controls set
  healthcare_category = 'audit_logs',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'audit_logs has no UPDATE/DELETE policy granted to any role; only INSERT and SELECT.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'Audit log integrity is preserved by database-level append-only enforcement.'
where control_key = 'LOG-003';

-- VEN-001 BAA on file for every PHI-handling vendor
update controls set
  healthcare_category = 'vendor_baa_management',
  automation_status = 'semi_automated',
  evidence_summary = 'BAA Vault shows a current signed BAA for every vendor flagged phi_access=true.',
  remediation_guide = $$
1. Open Fortify → Vendors → filter "PHI access: yes"
2. For any vendor without a current BAA, upload the signed PDF in the vendor row
3. If the vendor refuses to sign a BAA, they cannot receive PHI — switch vendors or remove PHI flow
4. Renewal alerts fire automatically at 60 and 30 days before expiry
$$,
  report_output_text = 'Practice maintains a signed Business Associate Agreement on file for every vendor that handles PHI.'
where control_key = 'VEN-001';

-- VEN-002 Vendor risk assessment at onboarding and annually
update controls set
  healthcare_category = 'vendor_baa_management',
  automation_status = 'manual_attestation',
  evidence_summary = 'Each vendor row has a vendor_risk_assessment record dated within the last 12 months.',
  remediation_guide = $$
1. Open the vendor row in Fortify → Vendors
2. Click "New risk assessment"
3. Upload their latest SOC 2 / HITRUST / ISO certificate, or fill the questionnaire
4. Save — the attestation timestamps the review
$$,
  report_output_text = 'Practice assesses vendor security posture at onboarding and at least annually.'
where control_key = 'VEN-002';

-- VEN-003 BAA expiration alerts
update controls set
  healthcare_category = 'vendor_baa_management',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'Fortify cron checks BAA expiry daily and emails the practice admin at 60 and 30 day thresholds.',
  remediation_guide = 'Fortify-managed control. Ensure the practice admin email is current under Settings → Profile.',
  report_output_text = 'Fortify automatically alerts the practice 60 and 30 days before any BAA expiration.'
where control_key = 'VEN-003';

-- INC-001 Incident response plan
update controls set
  healthcare_category = 'incident_response',
  automation_status = 'document_upload',
  evidence_summary = 'Current Incident Response Plan PDF uploaded within the last 12 months and acknowledged by leadership.',
  remediation_guide = $$
1. If you do not have an IR plan, generate one from Fortify → Policies → "Incident Response Plan" template
2. Have leadership review and sign the plan
3. Upload the signed PDF to Fortify → Documents → Incident Response Plan
4. Schedule the next annual review date
$$,
  report_output_text = 'Practice maintains a documented incident response plan reviewed at least annually.'
where control_key = 'INC-001';

-- INC-002 Breach notification procedures meet HIPAA timelines
update controls set
  healthcare_category = 'breach_notification',
  automation_status = 'manual_attestation',
  evidence_summary = 'Written breach notification procedure on file referencing the 60-day individual / HHS timelines.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "HIPAA Breach Notification Procedure" template
2. Verify the procedure includes:
   - Individual notification within 60 days of discovery
   - HHS notification within 60 days (annual roll-up if <500 affected, immediate if ≥500)
   - Prominent media notice if a single state has ≥500 affected
3. Have leadership sign and date the procedure
$$,
  report_output_text = 'Practice maintains breach notification procedures meeting HIPAA §164.404–410 timelines.'
where control_key = 'INC-002';

-- INC-003 Security incident drills annually
update controls set
  healthcare_category = 'incident_response',
  automation_status = 'manual_attestation',
  evidence_summary = 'Tabletop exercise after-action document on file dated within the last 12 months.',
  remediation_guide = $$
1. Schedule a 60-minute tabletop with leadership + IT
2. Pick a scenario (ransomware, lost laptop, phishing breach)
3. Walk through detection → containment → notification → recovery
4. Document gaps and assign owners
5. Upload the after-action notes to Fortify → Documents → Incident Drills
$$,
  report_output_text = 'Practice conducts and documents a security incident drill at least annually.'
where control_key = 'INC-003';

-- BCK-001 Automated backups every 24 hours
update controls set
  healthcare_category = 'backup_disaster_recovery',
  automation_status = 'document_upload',
  evidence_summary = 'EHR/practice-management vendor backup attestation on file showing daily backup cadence.',
  remediation_guide = $$
1. Confirm with your EHR / practice-management vendor that backups run at least daily
2. Request their written backup attestation (most include it in their SOC 2 report)
3. Upload to Fortify → Documents → Backup Attestation
4. If you self-host any data, verify automated daily backups + offsite storage
$$,
  report_output_text = 'Practice clinical data is backed up at least daily with geographically separated storage.'
where control_key = 'BCK-001';

-- BCK-002 Backup restoration tested quarterly
update controls set
  healthcare_category = 'backup_disaster_recovery',
  automation_status = 'manual_attestation',
  evidence_summary = 'Quarterly restore-test attestation on file dated within the last 90 days.',
  remediation_guide = $$
1. Coordinate with your EHR vendor for a test restore window (most can do this on request)
2. Document: date tested, sample restored, time to restore, any issues
3. Upload the test record to Fortify → Documents → Restore Tests
4. Schedule the next quarterly test
$$,
  report_output_text = 'Practice tests backup restoration at least quarterly and documents the result.'
where control_key = 'BCK-002';

-- BCK-003 Disaster recovery plan with RTO/RPO
update controls set
  healthcare_category = 'backup_disaster_recovery',
  automation_status = 'document_upload',
  evidence_summary = 'Disaster Recovery Plan with stated RTO and RPO on file, reviewed within last 12 months.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Disaster Recovery Plan" template
2. Fill in Recovery Time Objective (how long can you be down — typically 8-24h for an outpatient practice)
3. Fill in Recovery Point Objective (max acceptable data loss — typically last completed daily backup)
4. Have leadership sign and upload
$$,
  report_output_text = 'Practice maintains a documented Disaster Recovery Plan with defined RTO and RPO.'
where control_key = 'BCK-003';

-- TRN-001 Annual HIPAA security training
update controls set
  healthcare_category = 'hipaa_training',
  automation_status = 'semi_automated',
  evidence_summary = '≥95% of workforce has a training completion record dated within the last 365 days.',
  remediation_guide = $$
1. Open Fortify → Training → HIPAA Annual
2. For any member without a completion record, click "Send invite"
3. The member completes the module + quiz; completion is recorded automatically
4. Track completion rate; escalate stragglers to their manager after 30 days
$$,
  report_output_text = 'Practice provides and tracks annual HIPAA security training for all workforce members.'
where control_key = 'TRN-001';

-- TRN-002 Role-specific training
update controls set
  healthcare_category = 'hipaa_training',
  automation_status = 'semi_automated',
  evidence_summary = 'Each admin/clinical role has a role-specific training completion dated within the last 12 months.',
  remediation_guide = $$
1. Open Fortify → Training → Role-specific
2. Assign admin training to owners/admins; clinical training to clinical staff
3. Completion is tracked automatically; the audit log captures who completed what when
$$,
  report_output_text = 'Practice provides role-specific security training to administrators and clinical staff.'
where control_key = 'TRN-002';

-- TRN-003 Phishing simulation
update controls set
  healthcare_category = 'hipaa_training',
  automation_status = 'semi_automated',
  evidence_summary = 'Phishing simulation campaigns logged at ≥2 per year; click-rate tracked; repeat clickers re-trained.',
  remediation_guide = $$
1. Run a simulated phishing campaign through your email security vendor (KnowBe4, Proofpoint, M365 Attack Simulator)
2. Document the campaign date, click rate, who clicked
3. Re-train repeat clickers
4. Upload campaign report to Fortify → Documents → Phishing Simulations
$$,
  report_output_text = 'Practice runs phishing simulations at least twice per year and re-trains repeat clickers.'
where control_key = 'TRN-003';

-- CHG-001 Change management for production systems
update controls set
  healthcare_category = 'change_management',
  automation_status = 'fully_automated',
  audience = 'fortify_internal',
  evidence_summary = 'Every Fortify production change has a code-review approver recorded in the git history.',
  remediation_guide = 'Fortify-managed control. No action required by the practice.',
  report_output_text = 'Fortify production changes follow a documented change-management process with peer review.'
where control_key = 'CHG-001';

-- CHG-002 Separation of duties for high-risk operations
update controls set
  healthcare_category = 'change_management',
  automation_status = 'manual_attestation',
  evidence_summary = 'Documented separation-of-duties matrix for high-risk operations (deploys, billing, role promotion to owner).',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Separation of Duties" template
2. Map who can initiate vs approve each high-risk operation
3. Have leadership sign
4. Upload the signed matrix
$$,
  report_output_text = 'Practice maintains separation of duties for high-risk operations such as production changes and role promotion.'
where control_key = 'CHG-002';

-- POL-001 Information security policy reviewed annually
update controls set
  healthcare_category = 'policy_acknowledgments',
  automation_status = 'document_upload',
  evidence_summary = 'Information Security Policy on file, reviewed within the last 12 months, acknowledged by every workforce member.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Information Security Policy" template
2. Leadership reviews + signs annually
3. Publish the policy in Fortify → Policies — every workforce member is auto-assigned an acknowledgement task
4. Track acknowledgement completion on the dashboard
$$,
  report_output_text = 'Practice maintains a written Information Security Policy reviewed annually and acknowledged by all workforce members.'
where control_key = 'POL-001';

-- POL-002 Acceptable use policy
update controls set
  healthcare_category = 'policy_acknowledgments',
  automation_status = 'document_upload',
  evidence_summary = 'Acceptable Use Policy on file, acknowledged by every workforce member at hire and after material change.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Acceptable Use Policy" template
2. Publish — new hires auto-receive an acknowledgement task in onboarding
3. On material change, re-publish — every member gets a fresh ack task
$$,
  report_output_text = 'Practice maintains an Acceptable Use Policy acknowledged by every workforce member.'
where control_key = 'POL-002';

-- POL-003 Privacy policy
update controls set
  healthcare_category = 'policy_acknowledgments',
  automation_status = 'document_upload',
  evidence_summary = 'Notice of Privacy Practices on file meeting HIPAA Privacy Rule (§164.520) requirements.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Notice of Privacy Practices" template
2. Verify it covers: uses/disclosures, individual rights, complaints, effective date, point of contact
3. Post visibly in the practice + on your website
4. Distribute to each new patient at first encounter
$$,
  report_output_text = 'Practice maintains a Notice of Privacy Practices meeting HIPAA Privacy Rule requirements.'
where control_key = 'POL-003';

-- RSK-001 Risk assessment performed annually
update controls set
  healthcare_category = 'risk_assessments',
  automation_status = 'semi_automated',
  evidence_summary = 'Risk assessment completed within the last 365 days with documented findings + remediation plan.',
  remediation_guide = $$
1. Open Fortify → Risk → Start Assessment
2. Complete the HIPAA SRA questionnaire (covers the §164.308(a)(1)(ii)(A) requirements)
3. Fortify generates a risk score, executive summary, and remediation plan
4. Leadership reviews and signs; the assessment is timestamped in the audit log
$$,
  report_output_text = 'Practice performs and documents a formal risk assessment at least annually covering threats to ePHI.'
where control_key = 'RSK-001';

-- RSK-002 Risk register maintained
update controls set
  healthcare_category = 'risk_assessments',
  automation_status = 'semi_automated',
  evidence_summary = 'Risk register has all identified risks with owner, severity, mitigation, and quarterly review timestamp.',
  remediation_guide = $$
1. Open Fortify → Risk → Register
2. For each finding from the most recent assessment, set: owner, severity, mitigation, target date
3. Review quarterly — Fortify will surface risks past their target date in the punch list
$$,
  report_output_text = 'Practice maintains a risk register with owner, severity, and mitigation, reviewed at least quarterly.'
where control_key = 'RSK-002';

-- PHY-001 Physical access controls
update controls set
  healthcare_category = 'physical_safeguards',
  automation_status = 'manual_attestation',
  evidence_summary = 'Facility access procedures documented; visitor log maintained.',
  remediation_guide = $$
1. Document who has keys / badges / codes for each facility area
2. Implement a visitor log at reception (sign-in/sign-out, escort policy)
3. Annually verify the badge/key holder list against the current workforce
4. Upload the access procedure document to Fortify → Documents → Physical Access
$$,
  report_output_text = 'Practice maintains physical access controls and a visitor log for facilities housing PHI systems.'
where control_key = 'PHY-001';

-- PHY-002 Workstation security in clinical areas
update controls set
  healthcare_category = 'physical_safeguards',
  automation_status = 'fully_automated',
  evidence_summary = 'Endpoint policy via M365 / Google enforces ≤5-minute screen lock on all workstations.',
  remediation_guide = $$
**Microsoft 365 / Intune**
1. Intune Admin Center → Devices → Compliance policies → "Maximum minutes of inactivity": 5
2. Assign to all enrolled devices

**Google Workspace**
1. Admin Console → Devices → Endpoint management → Settings → Password
2. Set "Maximum inactivity time" to 5 minutes
$$,
  report_output_text = 'Practice workstations enforce automatic screen lock within 5 minutes of inactivity.'
where control_key = 'PHY-002';

-- PHY-003 Media disposal
update controls set
  healthcare_category = 'physical_safeguards',
  automation_status = 'manual_attestation',
  evidence_summary = 'Media disposal procedure on file referencing NIST SP 800-88; disposal events logged.',
  remediation_guide = $$
1. Generate from Fortify → Policies → "Media Disposal" template (references NIST SP 800-88)
2. When disposing of a device with PHI: NIST-standard wipe OR physical destruction
3. Log each disposal: serial number, date, method, witness
4. Retain logs for 6 years
$$,
  report_output_text = 'Practice follows NIST SP 800-88 for the wipe or destruction of media containing PHI.'
where control_key = 'PHY-003';
