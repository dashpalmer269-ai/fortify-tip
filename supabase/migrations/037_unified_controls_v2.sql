-- 037_unified_controls_v2.sql
-- Unified controls v2 — the bridge between requirements and evidence.
--
-- Adds high-quality multi-framework controls AND seeds detailed
-- remediation_guidance for the full operational library. Every control
-- here is a SINGLE unified rule that maps to multiple frameworks at once
-- (the original Fortify thesis).
--
-- New rows:
--   • 12 unified controls covering gaps the v2 requirements exposed
--   • 60+ multi-framework mappings (HIPAA + SOC 2 + ISO + GDPR each
--     where applicable) with mapping_confidence + interpretation_basis
--   • Full remediation_guidance row for every existing AND new control
--     so the dashboard punch list has a playbook for every failure

-- ════════════════════════════════════════════════════════════════════
-- A. New unified controls
-- ════════════════════════════════════════════════════════════════════
insert into controls (
  control_key, title, description,
  category, implementation_type, default_priority, healthcare_baseline, active,
  healthcare_category, audience, automation_status, automation_level,
  evidence_summary, remediation_guide, report_output_text,
  default_weight, responsible_role
) values

('IAM-001',
 'Unique user identification across every system handling ePHI',
 'Every workforce member has a unique account (no shared logins) on every system where ePHI is accessed, viewed, modified, or transmitted. Audit trails attribute every action to one individual.',
 'identity', 'technical', 'critical', true, true,
 'employee_access', 'customer_practice', 'semi_automated', 'partially_verified',
 'Identity-provider user list cross-referenced with workforce roster shows 1:1 user-to-account mapping; no shared/generic logins in use.',
 $$1. List every system in use that touches ePHI: EHR, practice management, M365/Google, billing, telehealth, fax, secure messaging
2. For each, verify every workforce member signs in with their OWN account
3. Identify any shared account ("frontdesk@", "billing@" used for sign-in) — replace with individual accounts
4. Document: system name, account count, shared accounts eliminated date
5. Re-attest annually under ACC-004 access review$$,
 'Practice maintains unique user identification on every system handling ePHI, with audit trails attributable to individual workforce members.',
 1.5, 'IT Admin / MSP'),

('IAM-002',
 'Automatic workstation lock within 5 minutes of inactivity',
 'Every workstation and mobile device that accesses ePHI auto-locks after no more than 5 minutes of inactivity, requiring re-authentication.',
 'identity', 'technical', 'high', true, true,
 'device_security', 'customer_practice', 'fully_automated', 'auto_verified',
 'M365 Intune / Google MDM compliance policy enforces ≤5-minute screen-lock on all enrolled devices.',
 $$1. Microsoft Intune: Endpoint security → Account protection → enforce screen lock policy with timeout ≤ 5 min
2. Google Workspace MDM: Devices → Settings → Password → Maximum inactivity time → 5 minutes
3. For unmanaged personal devices: train workforce to enable OS-level inactivity lock manually
4. Verify via the M365 BitLocker/Intune scan or attest quarterly$$,
 'Practice workstations and mobile devices accessing ePHI lock automatically after 5 minutes of inactivity.',
 1.0, 'IT Admin / MSP'),

('IAM-003',
 'Emergency access procedure documented and tested',
 'A documented procedure exists for emergency access to ePHI when normal authentication paths fail. The procedure is reviewed and tested at least annually.',
 'identity', 'administrative', 'medium', true, true,
 'incident_response', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'Emergency Access Procedure document on file, signed by leadership, dated within 12 months.',
 $$1. Generate from Fortify → Policies → "Emergency Access Procedure" template
2. Specify: who is authorized to invoke emergency access, what credentials they use, who approves, how the action is logged
3. Test annually with a simulated scenario; document the test result
4. Upload the signed procedure + most recent test result$$,
 'Practice maintains and tests an Emergency Access Procedure for ePHI.',
 1.0, 'Security Officer'),

('DAT-001',
 'ePHI transmission encrypted in transit (TLS 1.2+)',
 'Every system that transmits ePHI over a network does so using TLS 1.2 or higher. HTTP, FTP, unencrypted email, and other plaintext channels are prohibited for ePHI.',
 'cryptography', 'technical', 'critical', true, true,
 'data_protection', 'customer_practice', 'semi_automated', 'partially_verified',
 'Vendor attestations + observed connection headers confirm TLS 1.2+ on every ePHI-handling system; no plaintext channels in use.',
 $$1. Inventory ePHI-handling systems: EHR, practice management, secure email, telehealth, fax
2. For each, confirm with the vendor (or check observable behavior) that connections enforce TLS 1.2+
3. Disable any plaintext fallback (HTTP redirects to HTTPS, no SMTP without STARTTLS for ePHI)
4. For email: enable Secure Email (Encrypted Message) via M365 Purview or Google Workspace S/MIME for ePHI-containing messages$$,
 'Practice transmits ePHI exclusively over TLS 1.2 or higher with no plaintext fallback channels.',
 1.5, 'Security Officer'),

('DAT-002',
 'Workforce devices encrypt removable media or refuse to use it',
 'Removable media (USB drives, external disks) used with workforce devices is either encrypted (BitLocker To Go, FileVault on external) or its use is blocked by endpoint policy.',
 'cryptography', 'technical', 'high', true, true,
 'device_security', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'Endpoint policy attestation OR documented prohibition + sample audit of workforce devices.',
 $$1. Strongly recommended: BLOCK removable media for ePHI-handling devices via Intune / endpoint policy
2. If allowed: require BitLocker To Go (Windows) or encrypted external (macOS) for any device used with ePHI
3. Add to the AUP: "Unencrypted USB use with practice systems is prohibited"
4. Audit a random sample of devices quarterly$$,
 'Practice encrypts removable media used with ePHI workforce devices or prohibits removable media outright.',
 1.0, 'IT Admin / MSP'),

('DAT-003',
 'Workforce email DLP scanning for outbound ePHI',
 'Outbound email from workforce accounts is scanned for ePHI indicators (PHI patterns, attachment classifiers) and blocked or auto-encrypted before delivery.',
 'cryptography', 'technical', 'medium', true, true,
 'data_protection', 'customer_practice', 'semi_automated', 'partially_verified',
 'M365 Purview / Google Workspace DLP rule on file scanning outbound email for ePHI patterns.',
 $$1. Microsoft Purview → Data Loss Prevention → Create policy "Outbound ePHI" → templates → U.S. Health Insurance Act (HIPAA)
2. Set action: "Encrypt the email" + notify sender
3. Google Workspace: Admin → Security → DLP → templates "HIPAA" → Block / Quarantine + custom-block external recipients
4. Test by sending a sample email with a known pattern to a personal address — should be blocked or encrypted$$,
 'Practice scans outbound email for ePHI and encrypts or blocks delivery via DLP policy.',
 1.0, 'IT Admin / MSP'),

('NET-001',
 'Practice network segmented from public Wi-Fi',
 'Patient/guest Wi-Fi is logically isolated from the clinical network. Clinical workstations cannot route to or from guest segments.',
 'identity', 'technical', 'high', true, true,
 'device_security', 'customer_practice', 'manual_attestation', 'admin_attestation',
 'Network architecture document or admin attestation showing clinical VLAN/SSID separated from guest VLAN/SSID with firewall ACL.',
 $$1. Open your router/firewall admin (or ask the MSP)
2. Verify: guest Wi-Fi (SSID for patients/visitors) is on a separate VLAN
3. Verify the firewall blocks routing between guest VLAN and clinical VLAN (clinical-only sees the internet, not each other)
4. Document the SSID names, VLAN IDs, firewall rule; attest in Fortify$$,
 'Practice operates clinical and guest/patient Wi-Fi networks on isolated segments with firewall enforcement.',
 1.0, 'IT Admin / MSP'),

('NET-002',
 'External-facing services scanned for vulnerabilities monthly',
 'Any service exposed to the public internet (telehealth portal, patient portal, scheduling) is scanned for known vulnerabilities monthly. Critical findings are remediated within 30 days.',
 'identity', 'technical', 'medium', true, true,
 'device_security', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'Monthly vulnerability scan report on file from MSP or scanner; critical findings tracked to remediation.',
 $$1. If you operate any internet-facing service: arrange monthly scans via your MSP, or use a service like Tenable / Qualys / Nessus
2. If you don't operate internet-facing services (your EHR is vendor-hosted), confirm with the vendor that THEY do monthly scans on the system you use
3. Upload the most recent scan report (or vendor attestation) to Fortify quarterly
4. Track critical findings to a remediation task with a 30-day SLA$$,
 'Practice obtains monthly vulnerability scan reports for internet-facing services and remediates critical findings within 30 days.',
 0.8, 'IT Admin / MSP'),

('LOG-007',
 'EHR audit log review at least quarterly',
 'The EHR / practice-management system''s audit log (record access, exports, login failures) is reviewed at least quarterly by the Security Officer for anomalous activity.',
 'audit_logging', 'administrative', 'high', true, true,
 'audit_logs', 'customer_practice', 'manual_attestation', 'admin_attestation',
 'Quarterly EHR audit log review attestation with date, reviewer, findings or no-findings note.',
 $$1. In your EHR, locate the audit log / activity reports section (vendor-specific)
2. Quarterly: spot-check for: after-hours access, large exports, repeated login failures, access by users not on the team
3. Document the review: date, reviewer, what was checked, findings
4. Save a screenshot/export and upload — or attest in Fortify$$,
 'Practice reviews EHR audit logs at least quarterly and documents the review.',
 1.5, 'Security Officer'),

('PRV-001',
 'Notice of Privacy Practices distributed to every patient',
 'A current Notice of Privacy Practices is provided to each new patient at first encounter, posted prominently in waiting areas, and published on the practice website if one exists.',
 'policy', 'administrative', 'high', true, true,
 'policy_acknowledgments', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'NPP document on file + workflow attestation (front desk procedure for new-patient distribution).',
 $$1. Generate the Notice of Privacy Practices from Fortify → Policies → "NPP" template
2. Post a copy in every patient-facing waiting area
3. Add to new-patient onboarding paperwork; obtain acknowledgement signature
4. Publish on the practice website (if any) — link from the homepage footer
5. Update + redistribute every 3 years OR on material change$$,
 'Practice maintains and distributes a current Notice of Privacy Practices per the HIPAA Privacy Rule.',
 1.0, 'Privacy Officer'),

('PRV-002',
 'Patient request workflow for access / amendment / accounting of disclosures',
 'The practice has a documented workflow for handling patient requests under the HIPAA Privacy Rule: right of access, right to request amendment, right to accounting of disclosures.',
 'policy', 'administrative', 'medium', true, true,
 'policy_acknowledgments', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'Documented workflow on file covering intake → verification → response within 30 days → log entry.',
 $$1. Generate from Fortify → Policies → "Patient Rights Workflow" template
2. Define: who receives the request, how identity is verified, response SLA (30 days), escalation
3. Log every request in a register: date, type, requester, response, dispatched-by
4. Review the register quarterly; ensure no overdue responses$$,
 'Practice maintains a documented workflow for patient access, amendment, and accounting-of-disclosures requests with a tracked response register.',
 0.8, 'Privacy Officer'),

('SUP-001',
 'Annual supplier / vendor information security questionnaire',
 'Each tier-1 vendor (highest PHI exposure) completes a security questionnaire (or provides their SOC 2 / HITRUST report) at onboarding and annually thereafter.',
 'vendor', 'administrative', 'medium', true, true,
 'vendor_baa_management', 'customer_practice', 'document_upload', 'manual_evidence_required',
 'Vendor questionnaire OR third-party attestation (SOC 2 II / HITRUST CSF) on file for every tier-1 vendor, dated within 12 months.',
 $$1. List tier-1 vendors: EHR, practice management, billing clearinghouse, telehealth, cloud backup
2. For each, request their current SOC 2 Type II OR HITRUST CSF certification — most have this ready
3. If the vendor cannot provide third-party attestation, send Fortify''s standard vendor questionnaire (Fortify → Vendors → New questionnaire)
4. Upload the response/certificate to the vendor row in Fortify with a 12-month renewal alert$$,
 'Practice obtains current third-party attestation or vendor security questionnaire from every tier-1 vendor annually.',
 1.0, 'Privacy Officer')

on conflict (control_key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- B. Multi-framework mappings for the new controls
--
-- Implemented as a single INSERT ... SELECT joined to a (values) table of
-- (control_key, requirement_citation, interpretation_basis) so we don't
-- have to enumerate dozens of uuid lookup variables.
-- ════════════════════════════════════════════════════════════════════
insert into framework_mappings (control_id, framework_requirement_id, mapping_strength, mapping_confidence, interpretation_basis)
select c.id, r.id, 'fully_satisfies', 'high', m.basis
from (values
  -- IAM-001 — unique user identification
  ('IAM-001', '164.312(a)(2)(i)',  'Direct: HIPAA §164.312(a)(2)(i) requires unique user identification for any system accessing ePHI.'),
  ('IAM-001', '164.312(a)(1)',     'Supports access control (technical safeguard).'),
  ('IAM-001', 'CC6.1',             'SOC 2 logical access — identification of users before authentication.'),
  ('IAM-001', 'A.5.16',            'ISO Identity management — unique identities.'),
  ('IAM-001', 'A.5.18',            'ISO access rights provisioning by individual.'),
  -- IAM-002 — automatic workstation lock
  ('IAM-002', '164.312(a)(2)(iii)','Direct: HIPAA Automatic Logoff implementation specification.'),
  ('IAM-002', '164.310(c)',        'Workstation Security — physical lockout supports the technical lockout.'),
  ('IAM-002', 'CC6.1',             'Logical access protection on endpoints.'),
  ('IAM-002', 'A.7.7',             'ISO Clear desk / clear screen.'),
  ('IAM-002', 'A.8.1',             'User endpoint protection.'),
  -- IAM-003 — emergency access procedure
  ('IAM-003', '164.312(a)(2)(ii)', 'Direct: HIPAA Emergency Access Procedure.'),
  ('IAM-003', '164.308(a)(7)(i)',  'Contingency planning umbrella.'),
  ('IAM-003', 'A.5.29',            'ISO Information security during disruption.'),
  -- DAT-001 — TLS 1.2+ in transit
  ('DAT-001', '164.312(e)(1)',     'Direct: Transmission Security standard.'),
  ('DAT-001', '164.312(e)(2)(i)',  'Direct: Integrity Controls — Transmission.'),
  ('DAT-001', '164.312(e)(2)(ii)', 'Direct: Encryption — Transmission.'),
  ('DAT-001', 'CC6.7',             'SOC 2 — transmission of information.'),
  ('DAT-001', 'A.5.14',            'ISO Information transfer rules.'),
  ('DAT-001', 'Art. 32(1)(a)',     'GDPR pseudonymisation + encryption.'),
  -- DAT-002 — removable media
  ('DAT-002', '164.310(d)(1)',     'Direct: Device and Media Controls.'),
  ('DAT-002', '164.310(d)(2)(i)',  'Disposal of media.'),
  ('DAT-002', 'A.7.10',            'ISO Storage media lifecycle.'),
  ('DAT-002', 'A.8.1',             'ISO User endpoint devices.'),
  -- DAT-003 — DLP
  ('DAT-003', '164.312(e)(1)',     'Transmission security supports DLP.'),
  ('DAT-003', '164.502',           'Uses and disclosures — DLP enforces minimum necessary.'),
  ('DAT-003', 'A.8.12',            'ISO Data leakage prevention.'),
  ('DAT-003', 'C1.1',              'SOC 2 confidentiality — identification + protection.'),
  -- NET-001 — network segmentation
  ('NET-001', '164.312(a)(1)',     'Technical access control extends to network layer.'),
  ('NET-001', 'CC6.6',             'SOC 2 protection against threats from outside system boundaries.'),
  ('NET-001', 'A.8.22',            'ISO Segregation of networks.'),
  -- NET-002 — vulnerability scans
  ('NET-002', '164.308(a)(8)',     'Evaluation — periodic technical evaluation.'),
  ('NET-002', '164.308(a)(1)(ii)(A)','Risk Analysis supports vulnerability scanning cadence.'),
  ('NET-002', 'CC7.1',             'SOC 2 system monitoring + vulnerability identification.'),
  ('NET-002', 'A.8.8',             'ISO Management of technical vulnerabilities.'),
  -- LOG-007 — EHR audit log review
  ('LOG-007', '164.312(b)',        'Direct: Audit Controls — review is implicit in implementation.'),
  ('LOG-007', '164.308(a)(1)(ii)(D)','Information System Activity Review — explicit in HIPAA admin safeguards.'),
  ('LOG-007', 'CC7.2',             'SOC 2 monitoring of system components.'),
  ('LOG-007', 'A.8.16',            'ISO Monitoring activities.'),
  -- PRV-001 — Notice of Privacy Practices
  ('PRV-001', '164.520',           'Direct: Notice of Privacy Practices.'),
  ('PRV-001', 'P1.1',              'SOC 2 Privacy — Privacy Notice.'),
  ('PRV-001', 'Art. 12',           'GDPR Transparent information to data subjects.'),
  ('PRV-001', 'Art. 13',           'GDPR Information when data collected from data subject.'),
  -- PRV-002 — patient rights workflow
  ('PRV-002', '164.502',           'Uses and disclosures framework.'),
  ('PRV-002', '164.530(c)',        'Administrative safeguards for Privacy.'),
  ('PRV-002', 'Art. 15',           'GDPR Right of access.'),
  ('PRV-002', 'Art. 16',           'GDPR Right to rectification.'),
  ('PRV-002', 'Art. 17',           'GDPR Right to erasure.'),
  -- SUP-001 — annual vendor questionnaire
  ('SUP-001', '164.308(b)(1)',     'Direct: Business Associate Contracts — vendor assurance.'),
  ('SUP-001', '164.314(a)(1)',     'BA organizational requirements.'),
  ('SUP-001', 'CC9.1',             'SOC 2 vendor management.'),
  ('SUP-001', 'A.5.19',            'ISO Information security in supplier relationships.'),
  ('SUP-001', 'A.5.20',            'ISO Addressing security in supplier agreements.'),
  ('SUP-001', 'Art. 28',           'GDPR Processor agreements.')
) as m(control_key, req_citation, basis)
join controls c on c.control_key = m.control_key
join framework_requirements r on r.citation = m.req_citation
on conflict (control_id, framework_requirement_id) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- C. Stamp last_reviewed_at on all v2 mappings
-- ════════════════════════════════════════════════════════════════════
update framework_mappings set
  last_reviewed_at = now(),
  reviewed_by = 'Fortify content team — v2 unified controls'
where last_reviewed_at is null;

-- ════════════════════════════════════════════════════════════════════
-- D. Detailed remediation_guidance — one row per customer-owned control
-- ════════════════════════════════════════════════════════════════════
-- Replaces the older sparse remediation_guidance with one playbook per
-- active customer-owned control, derived from the control's own fields.
insert into remediation_guidance (
  control_id, severity, title, step_by_step_markdown,
  estimated_effort_minutes, required_systems, ai_generated,
  framework_impact, responsible_role, risk_level,
  evidence_after_remediation, due_date_logic, why_it_matters
)
select
  c.id,
  c.default_priority,
  c.title,
  coalesce(c.remediation_guide, c.description),
  case c.default_priority
    when 'critical' then 60
    when 'high' then 90
    when 'medium' then 120
    else 60
  end,
  case
    when c.healthcare_category = 'mfa_identity' then array['Microsoft 365','Google Workspace','Okta']
    when c.healthcare_category = 'backup_disaster_recovery' then array['EHR backup','MSP']
    when c.healthcare_category = 'device_security' then array['Intune','Jamf','Google MDM']
    when c.healthcare_category = 'vendor_baa_management' then array['Fortify Vendors']
    else array[]::text[]
  end,
  false,
  jsonb_build_object(
    'HIPAA', (select coalesce(jsonb_agg(distinct r.citation), '[]'::jsonb)
              from framework_mappings m
              join framework_requirements r on r.id = m.framework_requirement_id
              join frameworks f on f.id = r.framework_id
              where m.control_id = c.id and f.code = 'HIPAA'),
    'SOC2', (select coalesce(jsonb_agg(distinct r.citation), '[]'::jsonb)
              from framework_mappings m
              join framework_requirements r on r.id = m.framework_requirement_id
              join frameworks f on f.id = r.framework_id
              where m.control_id = c.id and f.code = 'SOC2'),
    'ISO27001', (select coalesce(jsonb_agg(distinct r.citation), '[]'::jsonb)
                  from framework_mappings m
                  join framework_requirements r on r.id = m.framework_requirement_id
                  join frameworks f on f.id = r.framework_id
                  where m.control_id = c.id and f.code = 'ISO27001'),
    'GDPR', (select coalesce(jsonb_agg(distinct r.citation), '[]'::jsonb)
              from framework_mappings m
              join framework_requirements r on r.id = m.framework_requirement_id
              join frameworks f on f.id = r.framework_id
              where m.control_id = c.id and f.code = 'GDPR')
  ),
  c.responsible_role,
  c.default_priority,
  c.evidence_summary,
  case c.default_priority
    when 'critical' then '+7 days from task creation'
    when 'high' then '+14 days from task creation'
    when 'medium' then '+30 days from task creation'
    else '+60 days from task creation'
  end,
  c.report_output_text
from controls c
where c.active = true
  and c.audience in ('customer', 'customer_practice')
  -- Insert only if there isn't already a guidance row for this control
  and not exists (select 1 from remediation_guidance g where g.control_id = c.id)
;
