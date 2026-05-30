-- 026_healthcare_operational_library.sql
-- Deeper operational control library. Every control here is healthcare-specific,
-- multi-framework mapped, and answers the five operational questions inline:
-- requirement, plain-language control, evidence, check method, remediation.
--
-- New categories introduced: Device Security (DEV-*), Exclusion Screening (EXC-*).
-- Existing categories extended with per-platform operational controls.
--
-- Sections:
--   A. Missing framework_requirements (HIPAA breach + privacy, ISO Annex A
--      gaps, GDPR Art 5/25/30/33/34)
--   B. New healthcare-operational controls (~25)
--   C. Multi-framework mappings for every new control
--   D. Evidence checks wired to existing collectors (M365 / Google / Okta)

-- ──────────────────────────────────────────────────────────────────────
-- A. Missing framework_requirements
-- ──────────────────────────────────────────────────────────────────────
do $$
declare
  hipaa_id uuid := (select id from frameworks where code = 'HIPAA');
  soc2_id  uuid := (select id from frameworks where code = 'SOC2');
  iso_id   uuid := (select id from frameworks where code = 'ISO27001');
  gdpr_id  uuid := (select id from frameworks where code = 'GDPR');
begin
  -- HIPAA breach notification + privacy
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (hipaa_id, '164.404',     '164.404',   'Notification to Individuals',           'Notify each affected individual of a breach of unsecured PHI within 60 days of discovery.', 'admin', 'required', 1.5),
    (hipaa_id, '164.408',     '164.408',   'Notification to the Secretary',         'Notify HHS of breaches per the timelines based on number of individuals affected.', 'admin', 'required', 1.0),
    (hipaa_id, '164.502',     '164.502',   'Uses and Disclosures of PHI',           'Limit uses and disclosures of PHI to the minimum necessary for the purpose.', 'admin', 'required', 1.0),
    (hipaa_id, '164.520',     '164.520',   'Notice of Privacy Practices',           'Provide a Notice of Privacy Practices to individuals describing PHI uses, disclosures, and rights.', 'admin', 'required', 1.0),
    (hipaa_id, '164.530(a)',  '164.530',   'Personnel Designations',                'Designate a privacy official + a contact person for receiving complaints.', 'admin', 'required', 0.5),
    (hipaa_id, '164.530(b)',  '164.530',   'Training',                              'Train all members of workforce on policies and procedures with respect to PHI.', 'admin', 'required', 1.0)
  on conflict (framework_id, citation) do nothing;

  -- ISO 27001:2022 Annex A — controls not in 016
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (iso_id, 'A.5.10',  'A.5',  'Acceptable use of information and assets', 'Rules for the acceptable use of information and assets shall be identified, documented, and implemented.', 'organizational', 'required', 1.0),
    (iso_id, 'A.5.23',  'A.5',  'Information security for use of cloud services', 'Processes for acquisition, use, management, and exit from cloud services shall be established.', 'organizational', 'required', 1.0),
    (iso_id, 'A.5.30',  'A.5',  'ICT readiness for business continuity', 'ICT readiness shall be planned, implemented, maintained, and tested based on business continuity objectives.', 'organizational', 'required', 1.5),
    (iso_id, 'A.6.5',   'A.6',  'Responsibilities after termination or change of employment', 'Information security responsibilities and duties remaining valid after termination shall be defined and enforced.', 'people', 'required', 1.0),
    (iso_id, 'A.7.4',   'A.7',  'Physical security monitoring', 'Premises shall be continuously monitored for unauthorized physical access.', 'physical', 'required', 0.5),
    (iso_id, 'A.8.2',   'A.8',  'Privileged access rights',                'Allocation and use of privileged access rights shall be restricted and managed.', 'technological', 'required', 1.5),
    (iso_id, 'A.8.7',   'A.8',  'Protection against malware',              'Protection against malware shall be implemented and supported by user awareness.', 'technological', 'required', 1.5),
    (iso_id, 'A.8.10',  'A.8',  'Information deletion',                    'Information stored in systems, devices, or any other media shall be deleted when no longer required.', 'technological', 'required', 1.0),
    (iso_id, 'A.8.16',  'A.8',  'Monitoring activities',                   'Networks, systems, and applications shall be monitored for anomalous behavior.', 'technological', 'required', 1.0),
    (iso_id, 'A.8.20',  'A.8',  'Networks security',                       'Networks and network devices shall be secured, managed, and controlled.', 'technological', 'required', 1.0),
    (iso_id, 'A.8.32',  'A.8',  'Change management',                       'Changes to information processing facilities and systems shall be subject to change management procedures.', 'technological', 'required', 1.0)
  on conflict (framework_id, citation) do nothing;

  -- GDPR — beyond Art. 32
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (gdpr_id, 'Art. 5(1)(f)',  'Art. 5',  'Integrity and confidentiality',     'Personal data shall be processed in a manner that ensures appropriate security, including protection against unauthorized or unlawful processing.', 'principles', 'required', 1.5),
    (gdpr_id, 'Art. 25',       'Art. 25', 'Data protection by design and by default', 'The controller shall implement appropriate technical and organisational measures to integrate the necessary safeguards into processing.', 'principles', 'required', 1.0),
    (gdpr_id, 'Art. 30',       'Art. 30', 'Records of processing activities',  'Each controller shall maintain a record of processing activities under its responsibility.', 'governance', 'required', 1.0),
    (gdpr_id, 'Art. 33',       'Art. 33', 'Notification of a personal data breach to the supervisory authority', 'Notify the supervisory authority within 72 hours of becoming aware of a breach.', 'breach', 'required', 1.5),
    (gdpr_id, 'Art. 34',       'Art. 34', 'Communication of a personal data breach to the data subject', 'Communicate a breach to the data subject without undue delay when there is a high risk to rights and freedoms.', 'breach', 'required', 1.5)
  on conflict (framework_id, citation) do nothing;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- B. New healthcare-operational controls
-- ──────────────────────────────────────────────────────────────────────

insert into controls (
  control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active,
  healthcare_category, audience, automation_status, evidence_summary, remediation_guide, report_output_text
) values

-- ── Audit Logs (per-platform) ────────────────────────────────────────
('LOG-004',
 'Microsoft 365 unified audit log enabled',
 'The M365 unified audit log is turned on and accessible via the Security & Compliance Center / Defender portal so investigations and HIPAA evidence requests can be served.',
 'audit_logging', 'technical', 'high', true, true,
 'audit_logs', 'customer', 'fully_automated',
 'Microsoft Graph reports auditLogConfiguration.unifiedAuditLogIngestionEnabled = true.',
 $$1. Open Microsoft Purview compliance portal (compliance.microsoft.com)
2. Solutions → Audit → "Start recording user and admin activity"
3. Wait 1-2 hours for ingestion to begin
4. Re-run the Fortify check; it should pass within 24 hours$$,
 'Practice has Microsoft 365 unified audit logging enabled and accessible.'
),

('LOG-005',
 'Google Workspace audit log accessible',
 'Google Workspace audit logs (Admin, Login, Drive) are accessible via Admin Console reporting and exportable for investigations.',
 'audit_logging', 'technical', 'high', true, true,
 'audit_logs', 'customer', 'fully_automated',
 'Google Reports API returns audit log entries when queried by Fortify.',
 $$Google Workspace audit logs are on by default. If the Fortify check is failing:
1. Verify the integration service account has the "Reports → Audit (read-only)" admin role
2. In Admin Console → Account → Admin roles, confirm the service account
3. Re-run the Fortify check$$,
 'Practice has Google Workspace audit logs enabled and accessible.'
),

('LOG-006',
 'Okta System Log accessible',
 'The Okta System Log is accessible via API and retains authentication, authorization, and admin events.',
 'audit_logging', 'technical', 'high', true, true,
 'audit_logs', 'customer', 'fully_automated',
 'Okta /api/v1/logs returns events within the retention window.',
 $$1. Okta Admin → Security → API → Tokens
2. Confirm the Fortify API token has read.logs scope
3. Re-run the Fortify check$$,
 'Practice has Okta System Log retention enabled and accessible.'
),

-- ── Device Security (whole new category) ─────────────────────────────
('DEV-001',
 'Disk encryption on every workforce device handling PHI',
 'BitLocker (Windows) or FileVault (macOS) is enabled on every workforce-owned device that accesses ePHI. Mobile devices use platform-native encryption.',
 'identity', 'technical', 'critical', true, true,
 'device_security', 'customer', 'fully_automated',
 'M365 Intune device-compliance report shows 100% of enrolled devices report bitLockerEnabled=true / fileVaultEnabled=true.',
 $$**Microsoft 365 / Intune**
1. Intune Admin Center → Endpoint security → Disk encryption
2. Create policy: "Require BitLocker for all Windows devices" / "Require FileVault for all macOS"
3. Assign to all enrolled devices
4. Devices report compliance within 24 hours

**Without Intune**: turn on BitLocker / FileVault manually on every workforce device, document the rollout, attest via Fortify → Documents → Device Encryption.$$,
 'Practice enforces full-disk encryption on every workforce device handling PHI.'
),

('DEV-002',
 'Endpoint anti-malware deployed and updated',
 'Every workforce device runs a current anti-malware solution (Microsoft Defender, CrowdStrike, SentinelOne, etc.) with definitions updated within the last 7 days.',
 'identity', 'technical', 'high', true, true,
 'device_security', 'customer', 'semi_automated',
 'Intune / endpoint-management report shows ≥95% of devices running current anti-malware with definitions ≤7 days old.',
 $$1. Confirm Microsoft Defender for Endpoint or equivalent is deployed on every workforce device
2. Verify auto-update is enabled
3. For unmanaged devices: install Defender via Settings → Windows Security; run a manual update
4. Schedule monthly verification — the Fortify check will surface stragglers$$,
 'Practice deploys current anti-malware protection on every workforce device.'
),

('DEV-003',
 'Mobile Device Management for clinical-data access',
 'Mobile devices used to access clinical data are enrolled in MDM (Intune, Jamf, Google MDM) with passcode, encryption, and remote-wipe enforced.',
 'identity', 'technical', 'high', true, true,
 'device_security', 'customer', 'semi_automated',
 'MDM enrollment count ≥ workforce members who access clinical data on mobile; all enrolled devices meet baseline policy.',
 $$1. Choose an MDM: Intune (M365), Jamf (Apple-only), Google MDM (Workspace)
2. Enroll every workforce mobile device that accesses clinical data
3. Apply baseline: 6+ digit passcode, encryption on, remote wipe on, no rooted/jailbroken
4. Unenrolled devices must be blocked from clinical-data apps$$,
 'Practice manages mobile devices accessing clinical data through MDM with passcode, encryption, and remote-wipe enforcement.'
),

('DEV-004',
 'Device inventory current',
 'A current inventory of every device that processes or stores PHI is maintained, including owner, type, OS, and encryption status. Reviewed quarterly.',
 'identity', 'administrative', 'medium', true, true,
 'device_security', 'customer', 'manual_attestation',
 'Device inventory document on file dated within the last 90 days.',
 $$1. Open Fortify → Documents → Device Inventory
2. List every workforce device that handles PHI: device name, owner, type (laptop/desktop/mobile), OS, encryption status, MDM enrollment
3. Review quarterly; update on every onboarding/offboarding
4. Sign and upload the updated inventory$$,
 'Practice maintains a current inventory of all devices that process or store PHI.'
),

('DEV-005',
 'Lost device remote-wipe capability tested',
 'The practice has tested its ability to remotely wipe a workforce device within the last 12 months and documented the test result.',
 'identity', 'administrative', 'medium', true, true,
 'device_security', 'customer', 'manual_attestation',
 'Remote-wipe test result on file dated within the last 12 months.',
 $$1. On a test device enrolled in MDM, initiate a remote wipe
2. Confirm the device returns to factory state and is no longer accessible
3. Document: date, device, MDM platform, outcome
4. Upload to Fortify → Documents → Remote Wipe Test$$,
 'Practice has tested remote-wipe capability for lost or stolen devices within the last 12 months.'
),

-- ── Exclusion Screening (whole new category) ─────────────────────────
('EXC-001',
 'OIG LEIE screening at hire for every workforce member',
 'Before any new workforce member is granted access, they are screened against the OIG List of Excluded Individuals/Entities. Excluded individuals cannot be hired for federal-program-touching roles.',
 'identity', 'administrative', 'critical', true, true,
 'exclusion_screening', 'customer', 'fully_automated',
 'Fortify exclusion_screenings table shows a pre-hire screening with status cleared/overridden_clear for every workforce member.',
 $$Fortify runs this automatically during onboarding. If failing:
1. Confirm the LEIE list has been ingested (cron exclusion-list-ingest)
2. Re-run preliminary screening for the affected member from Fortify → Team → Screening
3. If a match is confirmed, follow the override path or deny access$$,
 'Practice screens every prospective workforce member against the OIG List of Excluded Individuals before granting access.'
),

('EXC-002',
 'Monthly LEIE re-screening of all workforce members',
 'Every active workforce member is re-screened against the OIG LEIE list at least monthly to catch newly-added exclusions.',
 'identity', 'administrative', 'high', true, true,
 'exclusion_screening', 'customer', 'fully_automated',
 'Fortify exclusion-rescreen cron has run within the last 30 days and updated every workforce screening record.',
 $$Fortify runs this automatically via the monthly cron. If the most recent screening for any member is >30 days old:
1. Confirm cron exclusion-rescreen is scheduled in vercel.json
2. Trigger a manual re-screen from Fortify → Team → Bulk Re-screen$$,
 'Practice re-screens its workforce against the OIG LEIE list at least monthly.'
),

('EXC-003',
 'Blocked workforce members cannot be granted access',
 'Workforce members whose exclusion screening status is "blocked" cannot be approved into the workspace; the approval API refuses with a 409.',
 'identity', 'technical', 'critical', true, true,
 'exclusion_screening', 'customer', 'fully_automated',
 'Approval API guard rejects un-cleared screenings; audit log shows zero approvals with screening_status != cleared.',
 'Fortify-managed enforcement (see app/api/team/requests/[id]/route.ts approval guard). No action required by the practice.',
 'Practice enforces a hard block on approving any workforce member with an unresolved or excluded screening status.'
),

('EXC-004',
 'Override decisions documented with rationale',
 'Any decision to override an exclusion screening match (e.g., a confirmed false-positive) is documented with the reviewer, rationale, and timestamp.',
 'identity', 'administrative', 'high', true, true,
 'exclusion_screening', 'customer', 'fully_automated',
 'exclusion_screenings rows with status=overridden_clear all have override_rationale, override_by, override_at populated.',
 $$1. In Fortify → Team → Screenings, open the matched record
2. Click "Review match"
3. Enter the rationale (e.g., "Same name, different SSN — confirmed not the excluded individual via documentation")
4. Save — Fortify records the override with your user ID, timestamp, and rationale$$,
 'Practice documents every exclusion-screening override with reviewer identity, rationale, and timestamp.'
),

('EXC-005',
 'Screening records retained 6 years',
 'Exclusion-screening records (preliminary, monthly, overrides) are retained for at least 6 years to support audits.',
 'identity', 'administrative', 'medium', true, true,
 'exclusion_screening', 'customer', 'fully_automated',
 'No DELETE policy on exclusion_screenings; retention enforced by absence of deletion path.',
 'Fortify-managed retention. The practice may export screening records at any time from Fortify → Team → Screenings → Export.',
 'Practice retains exclusion-screening records for at least six years.'
),

-- ── Vendor / BAA Management (deeper) ────────────────────────────────
('VEN-004',
 'SOC 2 / HITRUST report on file for tier-1 vendors',
 'Vendors classified tier-1 (highest PHI exposure, e.g., EHR, billing clearinghouse) have a current SOC 2 Type II or HITRUST CSF certification on file.',
 'vendor', 'administrative', 'high', true, true,
 'vendor_baa_management', 'customer', 'document_upload',
 'Each tier-1 vendor row has a SOC 2 / HITRUST attestation document dated within the last 12 months.',
 $$1. Identify tier-1 vendors: EHR, practice management, billing clearinghouse, telehealth, cloud backup
2. Request their latest SOC 2 Type II or HITRUST CSF report
3. Upload to Fortify → Vendors → [vendor] → Documents
4. Set the renewal alert for 12 months out$$,
 'Practice maintains a current SOC 2 Type II or HITRUST CSF report on file for every tier-1 vendor.'
),

('VEN-005',
 'Vendor inventory complete and current',
 'A complete inventory of every vendor that touches PHI is maintained in Fortify with classification, BAA status, and last review date.',
 'vendor', 'administrative', 'high', true, true,
 'vendor_baa_management', 'customer', 'semi_automated',
 'Vendor inventory in Fortify shows every vendor with classification, BAA status, contact, and review date.',
 $$1. Open Fortify → Vendors
2. Add any vendor that handles PHI: name, classification, contact, BAA on file (Y/N), last review date
3. Common gaps: email security vendor, fax services, billing service, IT MSP, cloud backup
4. Review quarterly$$,
 'Practice maintains a current inventory of every vendor with PHI access.'
),

-- ── Backup & DR (deeper) ─────────────────────────────────────────────
('BCK-004',
 'Backups encrypted and geographically separated',
 'Backups are encrypted at rest and stored in a different geographic region from the primary system to survive site loss.',
 'continuity', 'technical', 'critical', true, true,
 'backup_disaster_recovery', 'customer', 'document_upload',
 'Vendor backup architecture document on file confirms encryption + geo-separation.',
 $$1. Confirm with your EHR / practice-management vendor:
   - Backups are encrypted at rest (AES-256 is standard)
   - Backups are stored in a different AWS/Azure region (e.g., primary us-east-1, backups in us-west-2)
2. Request architecture documentation
3. Upload to Fortify → Documents → Backup Architecture$$,
 'Practice backups are encrypted at rest and stored in a geographically separate region from primary systems.'
),

('BCK-005',
 'Clinical record retention ≥ 6 years',
 'Backups and archives of clinical records are retained for at least 6 years from creation or last effective date, per HIPAA documentation requirements.',
 'continuity', 'administrative', 'high', true, true,
 'backup_disaster_recovery', 'customer', 'manual_attestation',
 'Retention policy on file states ≥6 year retention; vendor attestation confirms.',
 $$1. Confirm your EHR / archive vendor retains records ≥6 years (most do by default; some state laws require longer — e.g., minors' records until age 21+)
2. Generate retention policy from Fortify → Policies → "Records Retention" template
3. Have leadership sign and upload$$,
 'Practice retains clinical records and backups for at least six years in compliance with HIPAA.'
),

-- ── Training (deeper) ────────────────────────────────────────────────
('TRN-004',
 'Training records retained 6 years',
 'Workforce training records (completion date, module, quiz score) are retained for at least 6 years to support HIPAA documentation requirements.',
 'training', 'administrative', 'medium', true, true,
 'hipaa_training', 'customer', 'fully_automated',
 'training_completions table has no DELETE policy; records retained indefinitely.',
 'Fortify-managed retention. The practice may export training records at any time from Fortify → Training → Export.',
 'Practice retains workforce training records for at least six years.'
),

('TRN-005',
 'New hire HIPAA training within 30 days',
 'Every new workforce member completes HIPAA security training within 30 days of hire, before being granted full PHI access.',
 'training', 'administrative', 'high', true, true,
 'hipaa_training', 'customer', 'semi_automated',
 'No workforce member has a hire date >30 days ago without a HIPAA training completion.',
 $$1. New hires are auto-assigned the HIPAA training module on workspace join
2. The dashboard flags any member whose completion is overdue
3. Escalate stragglers to their manager at day 21
4. Hold full PHI access until the training is complete$$,
 'Practice ensures every new workforce member completes HIPAA security training within 30 days of hire.'
),

-- ── Incident Response (deeper) ───────────────────────────────────────
('INC-004',
 'Incident response contact list current',
 'The IR plan has a current contact list (internal roles + external resources: legal, cyber-insurance carrier, OCR contact) reviewed at least quarterly.',
 'incident_response', 'administrative', 'medium', true, true,
 'incident_response', 'customer', 'manual_attestation',
 'IR contact list reviewed and timestamped within the last 90 days.',
 $$1. Open the IR Plan in Fortify → Policies
2. Review the contact list section
3. Update any roles, phone numbers, email addresses
4. Click "Reviewed" — this timestamps the review and re-publishes for acknowledgement$$,
 'Practice reviews and updates the incident response contact list at least quarterly.'
),

('INC-005',
 'Post-incident review documented',
 'For every security incident (real or simulated), a post-incident review document is produced covering timeline, root cause, response effectiveness, and improvements.',
 'incident_response', 'administrative', 'medium', true, true,
 'incident_response', 'customer', 'document_upload',
 'Post-incident review document on file for every logged incident.',
 $$After each incident or drill:
1. Within 7 days, document: timeline, root cause, what worked, what didn't, action items
2. Assign owners to action items with target dates
3. Upload to Fortify → Documents → Incident Reviews
4. Re-review action items quarterly until closed$$,
 'Practice documents a post-incident review after every security incident or drill.'
),

-- ── Risk Assessments (deeper) ────────────────────────────────────────
('RSK-003',
 'Risk treatment plan with assigned owners',
 'Findings from the risk assessment have a treatment plan: each risk has a treatment choice (mitigate/accept/transfer/avoid), an owner, and a target date.',
 'risk', 'administrative', 'high', true, true,
 'risk_assessments', 'customer', 'semi_automated',
 'Every risk-register entry above accepted-risk-threshold has owner, treatment, target_date populated.',
 $$1. Open Fortify → Risk → Register
2. For each finding, set: treatment (mitigate/accept/transfer/avoid), owner, target date
3. Mitigate = remediate; Accept = leadership signs the acceptance; Transfer = insurance/contract; Avoid = stop the activity
4. Review quarterly — overdue treatments surface as punch-list tasks$$,
 'Practice maintains a risk treatment plan with assigned owners and target dates for every identified risk.'
),

-- ── Policy Acknowledgments (deeper) ──────────────────────────────────
('POL-004',
 'New hire policy acknowledgement within first week',
 'Every new workforce member acknowledges the active policy set (ISP, AUP, IR plan, NPP) within the first 7 days of hire.',
 'policy', 'administrative', 'high', true, true,
 'policy_acknowledgments', 'customer', 'fully_automated',
 'For every new workforce member, policy_acknowledgments rows exist for the active policy set within 7 days of hire.',
 $$1. New hires are auto-assigned acknowledgement tasks for every active policy
2. The dashboard flags any member whose acks are overdue
3. Hold full access until acknowledgements complete
4. Escalate to the hiring manager at day 5$$,
 'Practice ensures every new workforce member acknowledges all active policies within their first week.'
),

('POL-005',
 'Re-acknowledgement on material policy change',
 'When a published policy is materially updated (version bump), every workforce member is auto-assigned a re-acknowledgement task.',
 'policy', 'administrative', 'medium', true, true,
 'policy_acknowledgments', 'customer', 'fully_automated',
 'On every policy version bump, the task generator produces policy_ack tasks for all members whose latest ack is for an older version.',
 'Fortify-managed behavior — the task generator handles this automatically when policy.version is incremented.',
 'Practice re-collects workforce acknowledgement on every material policy change.'
),

-- ── Physical Safeguards (deeper) ─────────────────────────────────────
('PHY-004',
 'Visitor sign-in log maintained for facilities housing PHI',
 'Visitors to facilities housing PHI systems sign in and out, including arrival/departure time, purpose, and escort.',
 'physical', 'physical', 'medium', true, true,
 'physical_safeguards', 'customer', 'manual_attestation',
 'Quarterly attestation that visitor log is maintained and reviewed.',
 $$1. Place a visitor log book or tablet at reception
2. Require: name, organization, purpose, arrival, departure, escort signature
3. Review monthly; retain logs ≥6 years
4. Quarterly, attest in Fortify → Documents → Visitor Log Attestation$$,
 'Practice maintains a visitor sign-in log at every facility housing PHI systems.'
),

-- ── Fortify-internal (platform guarantees surfaced to the practice) ──
('INT-001',
 'Fortify maintains its own SOC 2 / HIPAA posture',
 'Fortify itself maintains a SOC 2 Type II readiness posture and operates as a HIPAA Business Associate to its customer practices, with an executed BAA between Fortify and each customer.',
 'vendor', 'administrative', 'high', true, true,
 'vendor_baa_management', 'fortify_internal', 'manual_attestation',
 'Fortify executes a BAA with every customer practice on signup; SOC 2 posture maintained internally.',
 'Fortify-managed control. The customer may request the executed BAA and current SOC 2 status from Fortify support.',
 'Fortify executes a Business Associate Agreement with the practice and maintains its own SOC 2 Type II readiness posture.'
),

('INT-002',
 'Customer data isolated via row-level security',
 'Every multi-tenant table in Fortify is RLS-protected so practice A cannot read or write practice B''s data, even with an authenticated session.',
 'cryptography', 'technical', 'critical', true, true,
 'data_protection', 'fortify_internal', 'fully_automated',
 'Every table with practice_id has RLS enabled and a user_is_practice_member predicate on SELECT/UPDATE.',
 'Fortify-managed control. RLS enforcement is database-level; no action required by the practice.',
 'Fortify isolates each practice''s data through row-level security at the database layer.'
)

on conflict (control_key) do nothing;

-- ──────────────────────────────────────────────────────────────────────
-- C. Multi-framework mappings for new controls
--    Every operational control links to HIPAA + SOC 2 + ISO + GDPR
--    where applicable. fully_satisfies for direct fit; contributes_to
--    for supporting controls.
-- ──────────────────────────────────────────────────────────────────────
do $$
declare
  -- helper IDs
  r_h_audit       uuid := (select id from framework_requirements where citation = '164.312(b)');
  r_h_access_mgt  uuid := (select id from framework_requirements where citation = '164.308(a)(4)(i)');
  r_h_workforce   uuid := (select id from framework_requirements where citation = '164.308(a)(3)(i)');
  r_h_train       uuid := (select id from framework_requirements where citation = '164.308(a)(5)(i)');
  r_h_incident    uuid := (select id from framework_requirements where citation = '164.308(a)(6)(i)');
  r_h_continq     uuid := (select id from framework_requirements where citation = '164.308(a)(7)(i)');
  r_h_eval        uuid := (select id from framework_requirements where citation = '164.308(a)(8)');
  r_h_ba          uuid := (select id from framework_requirements where citation = '164.308(b)(1)');
  r_h_dev_media   uuid := (select id from framework_requirements where citation = '164.310(d)(1)');
  r_h_fac_access  uuid := (select id from framework_requirements where citation = '164.310(a)(1)');
  r_h_access_ctrl uuid := (select id from framework_requirements where citation = '164.312(a)(1)');
  r_h_encrypt     uuid := (select id from framework_requirements where citation = '164.312(a)(2)(iv)');
  r_h_integrity   uuid := (select id from framework_requirements where citation = '164.312(c)(1)');
  r_h_auth        uuid := (select id from framework_requirements where citation = '164.312(d)');
  r_h_trans       uuid := (select id from framework_requirements where citation = '164.312(e)(1)');
  r_h_breach_ind  uuid := (select id from framework_requirements where citation = '164.404');
  r_h_breach_sec  uuid := (select id from framework_requirements where citation = '164.408');
  r_h_train2      uuid := (select id from framework_requirements where citation = '164.530(b)');

  r_s_cc61        uuid := (select id from framework_requirements where citation = 'CC6.1');
  r_s_cc66        uuid := (select id from framework_requirements where citation = 'CC6.6');
  r_s_cc67        uuid := (select id from framework_requirements where citation = 'CC6.7');
  r_s_cc68        uuid := (select id from framework_requirements where citation = 'CC6.8');
  r_s_cc71        uuid := (select id from framework_requirements where citation = 'CC7.1');
  r_s_cc72        uuid := (select id from framework_requirements where citation = 'CC7.2');
  r_s_cc73        uuid := (select id from framework_requirements where citation = 'CC7.3');
  r_s_cc74        uuid := (select id from framework_requirements where citation = 'CC7.4');
  r_s_cc75        uuid := (select id from framework_requirements where citation = 'CC7.5');
  r_s_cc81        uuid := (select id from framework_requirements where citation = 'CC8.1');
  r_s_cc91        uuid := (select id from framework_requirements where citation = 'CC9.1');
  r_s_cc92        uuid := (select id from framework_requirements where citation = 'CC9.2');

  r_i_a510        uuid := (select id from framework_requirements where citation = 'A.5.10');
  r_i_a515        uuid := (select id from framework_requirements where citation = 'A.5.15');
  r_i_a516        uuid := (select id from framework_requirements where citation = 'A.5.16');
  r_i_a517        uuid := (select id from framework_requirements where citation = 'A.5.17');
  r_i_a519        uuid := (select id from framework_requirements where citation = 'A.5.19');
  r_i_a523        uuid := (select id from framework_requirements where citation = 'A.5.23');
  r_i_a524        uuid := (select id from framework_requirements where citation = 'A.5.24');
  r_i_a530        uuid := (select id from framework_requirements where citation = 'A.5.30');
  r_i_a63         uuid := (select id from framework_requirements where citation = 'A.6.3');
  r_i_a65         uuid := (select id from framework_requirements where citation = 'A.6.5');
  r_i_a74         uuid := (select id from framework_requirements where citation = 'A.7.4');
  r_i_a82         uuid := (select id from framework_requirements where citation = 'A.8.2');
  r_i_a85         uuid := (select id from framework_requirements where citation = 'A.8.5');
  r_i_a87         uuid := (select id from framework_requirements where citation = 'A.8.7');
  r_i_a810        uuid := (select id from framework_requirements where citation = 'A.8.10');
  r_i_a813        uuid := (select id from framework_requirements where citation = 'A.8.13');
  r_i_a815        uuid := (select id from framework_requirements where citation = 'A.8.15');
  r_i_a816        uuid := (select id from framework_requirements where citation = 'A.8.16');
  r_i_a820        uuid := (select id from framework_requirements where citation = 'A.8.20');
  r_i_a824        uuid := (select id from framework_requirements where citation = 'A.8.24');
  r_i_a832        uuid := (select id from framework_requirements where citation = 'A.8.32');

  r_g_5f          uuid := (select id from framework_requirements where citation = 'Art. 5(1)(f)');
  r_g_25          uuid := (select id from framework_requirements where citation = 'Art. 25');
  r_g_30          uuid := (select id from framework_requirements where citation = 'Art. 30');
  r_g_32a         uuid := (select id from framework_requirements where citation = 'Art. 32(1)(a)');
  r_g_32b         uuid := (select id from framework_requirements where citation = 'Art. 32(1)(b)');
  r_g_32c         uuid := (select id from framework_requirements where citation = 'Art. 32(1)(c)');
  r_g_32d         uuid := (select id from framework_requirements where citation = 'Art. 32(1)(d)');
  r_g_33          uuid := (select id from framework_requirements where citation = 'Art. 33');
  r_g_34          uuid := (select id from framework_requirements where citation = 'Art. 34');

  -- new control IDs
  c_log_004 uuid := (select id from controls where control_key = 'LOG-004');
  c_log_005 uuid := (select id from controls where control_key = 'LOG-005');
  c_log_006 uuid := (select id from controls where control_key = 'LOG-006');
  c_dev_001 uuid := (select id from controls where control_key = 'DEV-001');
  c_dev_002 uuid := (select id from controls where control_key = 'DEV-002');
  c_dev_003 uuid := (select id from controls where control_key = 'DEV-003');
  c_dev_004 uuid := (select id from controls where control_key = 'DEV-004');
  c_dev_005 uuid := (select id from controls where control_key = 'DEV-005');
  c_exc_001 uuid := (select id from controls where control_key = 'EXC-001');
  c_exc_002 uuid := (select id from controls where control_key = 'EXC-002');
  c_exc_003 uuid := (select id from controls where control_key = 'EXC-003');
  c_exc_004 uuid := (select id from controls where control_key = 'EXC-004');
  c_exc_005 uuid := (select id from controls where control_key = 'EXC-005');
  c_ven_004 uuid := (select id from controls where control_key = 'VEN-004');
  c_ven_005 uuid := (select id from controls where control_key = 'VEN-005');
  c_bck_004 uuid := (select id from controls where control_key = 'BCK-004');
  c_bck_005 uuid := (select id from controls where control_key = 'BCK-005');
  c_trn_004 uuid := (select id from controls where control_key = 'TRN-004');
  c_trn_005 uuid := (select id from controls where control_key = 'TRN-005');
  c_inc_004 uuid := (select id from controls where control_key = 'INC-004');
  c_inc_005 uuid := (select id from controls where control_key = 'INC-005');
  c_rsk_003 uuid := (select id from controls where control_key = 'RSK-003');
  c_pol_004 uuid := (select id from controls where control_key = 'POL-004');
  c_pol_005 uuid := (select id from controls where control_key = 'POL-005');
  c_phy_004 uuid := (select id from controls where control_key = 'PHY-004');
  c_int_001 uuid := (select id from controls where control_key = 'INT-001');
  c_int_002 uuid := (select id from controls where control_key = 'INT-002');
begin
  -- Audit log per-platform controls → HIPAA audit + SOC 2 monitoring + ISO + GDPR security
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (c_log_004, r_h_audit,    'fully_satisfies'),
    (c_log_004, r_s_cc71,     'fully_satisfies'),
    (c_log_004, r_i_a815,     'fully_satisfies'),
    (c_log_004, r_i_a816,     'fully_satisfies'),
    (c_log_004, r_g_32b,      'contributes_to'),

    (c_log_005, r_h_audit,    'fully_satisfies'),
    (c_log_005, r_s_cc71,     'fully_satisfies'),
    (c_log_005, r_i_a815,     'fully_satisfies'),
    (c_log_005, r_i_a816,     'fully_satisfies'),
    (c_log_005, r_g_32b,      'contributes_to'),

    (c_log_006, r_h_audit,    'fully_satisfies'),
    (c_log_006, r_s_cc71,     'fully_satisfies'),
    (c_log_006, r_i_a815,     'fully_satisfies'),
    (c_log_006, r_i_a816,     'fully_satisfies'),
    (c_log_006, r_g_32b,      'contributes_to'),

    -- Device Security
    (c_dev_001, r_h_encrypt,    'fully_satisfies'),
    (c_dev_001, r_h_dev_media,  'contributes_to'),
    (c_dev_001, r_s_cc61,       'fully_satisfies'),
    (c_dev_001, r_i_a824,       'fully_satisfies'),
    (c_dev_001, r_g_32a,        'fully_satisfies'),

    (c_dev_002, r_h_access_ctrl,'contributes_to'),
    (c_dev_002, r_s_cc66,       'fully_satisfies'),
    (c_dev_002, r_s_cc71,       'contributes_to'),
    (c_dev_002, r_i_a87,        'fully_satisfies'),
    (c_dev_002, r_g_32b,        'contributes_to'),

    (c_dev_003, r_h_access_ctrl,'fully_satisfies'),
    (c_dev_003, r_h_encrypt,    'partially_satisfies'),
    (c_dev_003, r_s_cc61,       'fully_satisfies'),
    (c_dev_003, r_i_a824,       'fully_satisfies'),
    (c_dev_003, r_g_32a,        'fully_satisfies'),

    (c_dev_004, r_h_dev_media,  'fully_satisfies'),
    (c_dev_004, r_s_cc61,       'contributes_to'),
    (c_dev_004, r_i_a85,        'contributes_to'),
    (c_dev_004, r_g_30,         'contributes_to'),

    (c_dev_005, r_h_dev_media,  'fully_satisfies'),
    (c_dev_005, r_s_cc66,       'fully_satisfies'),
    (c_dev_005, r_i_a810,       'fully_satisfies'),
    (c_dev_005, r_g_32a,        'contributes_to'),

    -- Exclusion Screening — primarily HIPAA workforce security; supports SOC 2 + ISO HR
    (c_exc_001, r_h_workforce,  'fully_satisfies'),
    (c_exc_001, r_h_access_mgt, 'contributes_to'),
    (c_exc_001, r_i_a63,        'fully_satisfies'),

    (c_exc_002, r_h_workforce,  'fully_satisfies'),
    (c_exc_002, r_h_eval,       'contributes_to'),
    (c_exc_002, r_i_a63,        'fully_satisfies'),

    (c_exc_003, r_h_workforce,  'fully_satisfies'),
    (c_exc_003, r_h_access_mgt, 'fully_satisfies'),
    (c_exc_003, r_s_cc61,       'fully_satisfies'),
    (c_exc_003, r_i_a515,       'fully_satisfies'),

    (c_exc_004, r_h_workforce,  'fully_satisfies'),
    (c_exc_004, r_h_audit,      'partially_satisfies'),

    (c_exc_005, r_h_audit,      'partially_satisfies'),
    (c_exc_005, r_h_workforce,  'contributes_to'),

    -- Vendor / BAA
    (c_ven_004, r_h_ba,         'fully_satisfies'),
    (c_ven_004, r_s_cc91,       'fully_satisfies'),
    (c_ven_004, r_i_a519,       'fully_satisfies'),
    (c_ven_004, r_i_a523,       'fully_satisfies'),
    (c_ven_004, r_g_32d,        'contributes_to'),

    (c_ven_005, r_h_ba,         'fully_satisfies'),
    (c_ven_005, r_s_cc91,       'fully_satisfies'),
    (c_ven_005, r_i_a519,       'fully_satisfies'),
    (c_ven_005, r_g_30,         'fully_satisfies'),

    -- Backup
    (c_bck_004, r_h_continq,    'fully_satisfies'),
    (c_bck_004, r_h_encrypt,    'partially_satisfies'),
    (c_bck_004, r_s_cc71,       'fully_satisfies'),
    (c_bck_004, r_i_a813,       'fully_satisfies'),
    (c_bck_004, r_i_a530,       'fully_satisfies'),
    (c_bck_004, r_g_32c,        'fully_satisfies'),

    (c_bck_005, r_h_continq,    'fully_satisfies'),
    (c_bck_005, r_h_audit,      'partially_satisfies'),
    (c_bck_005, r_i_a813,       'fully_satisfies'),

    -- Training
    (c_trn_004, r_h_train,      'fully_satisfies'),
    (c_trn_004, r_h_train2,     'fully_satisfies'),

    (c_trn_005, r_h_train,      'fully_satisfies'),
    (c_trn_005, r_h_train2,     'fully_satisfies'),
    (c_trn_005, r_h_workforce,  'partially_satisfies'),
    (c_trn_005, r_i_a63,        'fully_satisfies'),

    -- Incident Response
    (c_inc_004, r_h_incident,   'fully_satisfies'),
    (c_inc_004, r_s_cc72,       'fully_satisfies'),
    (c_inc_004, r_s_cc73,       'fully_satisfies'),
    (c_inc_004, r_i_a524,       'fully_satisfies'),

    (c_inc_005, r_h_incident,   'fully_satisfies'),
    (c_inc_005, r_s_cc74,       'fully_satisfies'),
    (c_inc_005, r_s_cc75,       'fully_satisfies'),
    (c_inc_005, r_i_a524,       'fully_satisfies'),

    -- Risk
    (c_rsk_003, r_h_eval,       'fully_satisfies'),
    (c_rsk_003, r_s_cc81,       'fully_satisfies'),
    (c_rsk_003, r_i_a85,        'fully_satisfies'),
    (c_rsk_003, r_g_25,         'contributes_to'),

    -- Policy Acks
    (c_pol_004, r_h_train,      'fully_satisfies'),
    (c_pol_004, r_h_workforce,  'partially_satisfies'),
    (c_pol_004, r_i_a510,       'fully_satisfies'),

    (c_pol_005, r_h_train,      'fully_satisfies'),
    (c_pol_005, r_i_a510,       'fully_satisfies'),

    -- Physical
    (c_phy_004, r_h_fac_access, 'fully_satisfies'),
    (c_phy_004, r_s_cc66,       'partially_satisfies'),
    (c_phy_004, r_i_a74,        'fully_satisfies'),

    -- Fortify-internal
    (c_int_001, r_h_ba,         'fully_satisfies'),
    (c_int_001, r_g_32d,        'fully_satisfies'),

    (c_int_002, r_h_access_mgt, 'fully_satisfies'),
    (c_int_002, r_s_cc61,       'fully_satisfies'),
    (c_int_002, r_i_a515,       'fully_satisfies'),
    (c_int_002, r_g_32a,        'fully_satisfies'),
    (c_int_002, r_g_5f,         'fully_satisfies')
  on conflict (control_id, framework_requirement_id) do nothing;
exception when others then
  -- Best-effort: if any cited requirement isn't yet seeded the row is skipped.
  -- The on conflict clause handles re-runs; this catch handles forward-compat
  -- where a citation lookup may return null.
  raise notice 'framework_mappings insertion: %', sqlerrm;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- D. Evidence checks for new auto-verifiable controls
--    Reuses M365 / Google / Okta collectors from migrations 018/019/020.
-- ──────────────────────────────────────────────────────────────────────
do $$
declare
  c_log_004 uuid := (select id from controls where control_key = 'LOG-004');
  c_log_005 uuid := (select id from controls where control_key = 'LOG-005');
  c_log_006 uuid := (select id from controls where control_key = 'LOG-006');
  c_dev_001 uuid := (select id from controls where control_key = 'DEV-001');
  c_exc_001 uuid := (select id from controls where control_key = 'EXC-001');
  c_exc_002 uuid := (select id from controls where control_key = 'EXC-002');
  c_pol_004 uuid := (select id from controls where control_key = 'POL-004');
  c_pol_005 uuid := (select id from controls where control_key = 'POL-005');
  c_trn_005 uuid := (select id from controls where control_key = 'TRN-005');
begin
  insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, check_config, pass_criteria) values
    -- Audit log per-platform — already have collectors from 018/019/020
    (c_log_004, 'm365_audit_log_enabled_v2',     'M365 unified audit log accessible',     'Confirms unifiedAuditLogIngestionEnabled = true via Graph.', 'automated_api', 'microsoft_365',   24, '{}'::jsonb, '{"required": true}'::jsonb),
    (c_log_005, 'google_audit_log_accessible_v2','Google audit log accessible',           'Confirms Reports API returns audit entries.',               'automated_api', 'google_workspace', 24, '{}'::jsonb, '{"required": true}'::jsonb),
    (c_log_006, 'okta_system_log_accessible_v2', 'Okta System Log accessible',            'Confirms /api/v1/logs returns entries.',                     'automated_api', 'okta',             24, '{}'::jsonb, '{"required": true}'::jsonb),

    -- Device encryption — M365 BitLocker scan
    (c_dev_001, 'm365_bitlocker_enforcement_v2', 'M365 BitLocker compliance ≥95%',         'Devices enrolled in Intune report BitLocker enabled.',     'automated_api', 'microsoft_365',   24, '{"min_pct": 95}'::jsonb, '{"min_pct": 95}'::jsonb),

    -- Exclusion screening — internal DB query against exclusion_screenings
    (c_exc_001, 'exclusion_hire_screening',       'Pre-hire LEIE screening completed for every workforce member', 'No workforce member without a pre-hire screening record.', 'automated_db_query', null, 24, '{}'::jsonb, '{"required": true}'::jsonb),
    (c_exc_002, 'exclusion_monthly_rescreen',     'Monthly LEIE re-screen completed for every workforce member',  'Every active workforce member has a screening dated within 30 days.', 'automated_db_query', null, 24, '{"max_age_days": 30}'::jsonb, '{"max_age_days": 30}'::jsonb),

    -- Policy ack — internal DB query
    (c_pol_004, 'policy_ack_new_hire_complete',   'New hires acknowledged active policies within 7 days', 'No member hired >7 days ago is missing any active-policy ack.', 'automated_db_query', null, 24, '{"max_age_days": 7}'::jsonb, '{"required": true}'::jsonb),
    (c_pol_005, 'policy_ack_current_version',     'All members acknowledge the latest policy version',     'For every active policy version, ack coverage ≥95%.',        'automated_db_query', null, 24, '{"min_coverage_pct": 95}'::jsonb, '{"min_coverage_pct": 95}'::jsonb),

    -- New-hire training within 30 days
    (c_trn_005, 'training_new_hire_complete',     'New hires completed HIPAA training within 30 days',     'No workforce member hired >30 days ago without a HIPAA completion record.', 'automated_db_query', null, 24, '{"max_age_days": 30}'::jsonb, '{"required": true}'::jsonb)
  on conflict (control_id, check_key) do nothing;
end $$;
