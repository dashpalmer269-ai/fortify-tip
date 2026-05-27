-- 016_seed_control_library.sql
-- Seeds the Unified Control Mapping Engine with a starter library:
--   - 4 frameworks (HIPAA Security Rule, SOC 2 Trust Services, ISO 27001:2022, GDPR Article 32)
--   - 38 framework_requirements covering the highest-priority items per framework
--   - 32 controls covering identity, encryption, audit logging, vendor mgmt,
--     incident response, backup, change mgmt, awareness training, physical access
--   - Cross-framework mappings demonstrating that ONE control (e.g. "MFA enforced
--     for admin accounts") satisfies HIPAA §164.308(a)(4), SOC 2 CC6.1, ISO A.5.16,
--     and GDPR Art. 32(1)(b) — the unified-mapping payoff
--   - Remediation guidance for every control
--
-- This is content engineering. Tweak rows as your compliance team refines
-- which standards map where. The schema treats this as data — controls,
-- requirements, and mappings can be added or amended without code changes.

-- ── Frameworks ──────────────────────────────────────────────────────────
insert into frameworks (code, name, authority, current_version, description, active) values
  ('HIPAA',    'HIPAA Security Rule',     'HHS / Office for Civil Rights', '2003+omnibus 2013', 'Administrative, physical, and technical safeguards for electronic protected health information.', true),
  ('SOC2',     'SOC 2 Trust Services',    'AICPA',                          '2017+2022 points of focus', 'Security, availability, processing integrity, confidentiality, and privacy criteria.', true),
  ('ISO27001', 'ISO/IEC 27001:2022',      'ISO',                            '2022',               'Information security management system requirements + Annex A controls.', true),
  ('GDPR',     'GDPR Article 32',         'EU',                             '2016/679',           'Security of processing — appropriate technical and organisational measures.', true)
on conflict (code) do nothing;

-- ── Framework requirements ─────────────────────────────────────────────
-- For each framework, the top requirements practices encounter on audit.
do $$
declare
  hipaa_id uuid := (select id from frameworks where code = 'HIPAA');
  soc2_id  uuid := (select id from frameworks where code = 'SOC2');
  iso_id   uuid := (select id from frameworks where code = 'ISO27001');
  gdpr_id  uuid := (select id from frameworks where code = 'GDPR');
begin
  -- HIPAA Security Rule — administrative + technical + physical safeguards
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (hipaa_id, '164.308(a)(1)(i)',    '164.308(a)(1)',    'Security Management Process',          'Implement policies and procedures to prevent, detect, contain, and correct security violations.', 'admin', 'required',    1.5),
    (hipaa_id, '164.308(a)(1)(ii)(A)','164.308(a)(1)',    'Risk Analysis',                        'Conduct an accurate and thorough assessment of risks to ePHI.', 'admin', 'required', 1.5),
    (hipaa_id, '164.308(a)(1)(ii)(B)','164.308(a)(1)',    'Risk Management',                      'Implement security measures sufficient to reduce risks to a reasonable level.', 'admin', 'required', 1.5),
    (hipaa_id, '164.308(a)(3)(i)',    '164.308(a)(3)',    'Workforce Security',                   'Authorize and supervise workforce members who access ePHI.', 'admin', 'required', 1.0),
    (hipaa_id, '164.308(a)(4)(i)',    '164.308(a)(4)',    'Information Access Management',        'Implement policies for authorizing access to ePHI.', 'admin', 'required', 1.5),
    (hipaa_id, '164.308(a)(5)(i)',    '164.308(a)(5)',    'Security Awareness and Training',      'Implement a security awareness and training program for all workforce members.', 'admin', 'required', 1.0),
    (hipaa_id, '164.308(a)(6)(i)',    '164.308(a)(6)',    'Security Incident Procedures',         'Implement policies to address security incidents.', 'admin', 'required', 1.5),
    (hipaa_id, '164.308(a)(7)(i)',    '164.308(a)(7)',    'Contingency Plan',                     'Establish data backup, disaster recovery, and emergency operations plans.', 'admin', 'required', 1.5),
    (hipaa_id, '164.308(a)(8)',       '164.308(a)',       'Evaluation',                           'Perform periodic technical and nontechnical evaluations of safeguards.', 'admin', 'required', 1.0),
    (hipaa_id, '164.308(b)(1)',       '164.308(b)',       'Business Associate Contracts',         'Obtain satisfactory assurances via written contract that BAs will safeguard PHI.', 'admin', 'required', 1.5),
    (hipaa_id, '164.310(a)(1)',       '164.310(a)',       'Facility Access Controls',             'Limit physical access to electronic information systems and the facilities housing them.', 'physical', 'required', 1.0),
    (hipaa_id, '164.310(d)(1)',       '164.310(d)',       'Device and Media Controls',            'Implement policies for receipt and removal of hardware and electronic media containing ePHI.', 'physical', 'required', 1.0),
    (hipaa_id, '164.312(a)(1)',       '164.312(a)',       'Access Control',                       'Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorized persons.', 'technical', 'required', 1.5),
    (hipaa_id, '164.312(a)(2)(iv)',   '164.312(a)(2)',    'Encryption and Decryption',            'Implement a mechanism to encrypt and decrypt ePHI.', 'technical', 'addressable', 1.5),
    (hipaa_id, '164.312(b)',          '164.312',          'Audit Controls',                       'Implement hardware, software, and procedural mechanisms that record activity in systems containing ePHI.', 'technical', 'required', 1.5),
    (hipaa_id, '164.312(c)(1)',       '164.312',          'Integrity',                            'Protect ePHI from improper alteration or destruction.', 'technical', 'required', 1.0),
    (hipaa_id, '164.312(d)',          '164.312',          'Person or Entity Authentication',      'Verify a person seeking access to ePHI is the one claimed.', 'technical', 'required', 1.5),
    (hipaa_id, '164.312(e)(1)',       '164.312',          'Transmission Security',                'Implement technical measures to guard against unauthorized access to ePHI transmitted over an electronic network.', 'technical', 'required', 1.5)
  on conflict (framework_id, citation) do nothing;

  -- SOC 2 — Trust Services Criteria (focusing on Security TSCs that small practices encounter)
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (soc2_id, 'CC1.1', 'CC1', 'Integrity and Ethical Values',            'Demonstrate a commitment to integrity and ethical values.', 'control_environment', 'required', 1.0),
    (soc2_id, 'CC2.1', 'CC2', 'Communicates Information',                'Internally communicate information necessary to support functioning of internal control.', 'communication', 'required', 1.0),
    (soc2_id, 'CC5.1', 'CC5', 'Selects and Develops Control Activities', 'Select and develop control activities to mitigate risks.', 'control_activities', 'required', 1.0),
    (soc2_id, 'CC5.2', 'CC5', 'Technology Controls',                     'Select and develop general control activities over technology.', 'control_activities', 'required', 1.5),
    (soc2_id, 'CC6.1', 'CC6', 'Logical and Physical Access Controls',    'Implement logical access security software, infrastructure, and architectures over protected information assets.', 'access', 'required', 1.5),
    (soc2_id, 'CC6.6', 'CC6', 'External Logical Access',                 'Implement logical access security measures to protect against threats from sources outside its system boundaries.', 'access', 'required', 1.5),
    (soc2_id, 'CC6.7', 'CC6', 'Restricts Movement of Information',       'Restrict the transmission, movement, and removal of information to authorized internal and external users.', 'access', 'required', 1.5),
    (soc2_id, 'CC6.8', 'CC6', 'Prevents Unauthorized Software',          'Implement controls to prevent or detect and act upon the introduction of unauthorized or malicious software.', 'access', 'required', 1.0),
    (soc2_id, 'CC7.1', 'CC7', 'Detection of Anomalies',                  'Use detection and monitoring procedures to identify changes to configurations and anomalies indicative of malicious acts.', 'system_operations', 'required', 1.5),
    (soc2_id, 'CC7.2', 'CC7', 'Monitors System Components',              'Monitor system components and operation for anomalies.', 'system_operations', 'required', 1.0),
    (soc2_id, 'CC7.3', 'CC7', 'Evaluates Security Events',               'Evaluate security events to determine whether they could or have resulted in a security incident.', 'system_operations', 'required', 1.5),
    (soc2_id, 'CC7.4', 'CC7', 'Incident Response',                       'Implement an incident response plan to recover from identified security incidents.', 'system_operations', 'required', 1.5),
    (soc2_id, 'CC7.5', 'CC7', 'Recovery from Incidents',                 'Implement business resiliency activities to recover from identified security incidents.', 'system_operations', 'required', 1.0),
    (soc2_id, 'CC8.1', 'CC8', 'Change Management',                       'Authorize, design, develop, configure, document, test, approve, and implement changes to infrastructure, data, software, and procedures.', 'change_management', 'required', 1.0),
    (soc2_id, 'CC9.1', 'CC9', 'Identifies Business Disruptions',         'Identify, select, and develop risk mitigation activities for risks arising from potential business disruptions.', 'risk_mitigation', 'required', 1.0),
    (soc2_id, 'CC9.2', 'CC9', 'Vendor Risk Management',                  'Assess and manage risks associated with vendors and business partners.', 'risk_mitigation', 'required', 1.0)
  on conflict (framework_id, citation) do nothing;

  -- ISO/IEC 27001:2022 Annex A — high-priority controls from the 93-item catalog
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (iso_id, 'A.5.1',  'A.5',  'Policies for information security',       'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated, and acknowledged.', 'organizational', 'required', 1.0),
    (iso_id, 'A.5.15', 'A.5',  'Access control',                          'Rules to control physical and logical access to information shall be established.', 'organizational', 'required', 1.5),
    (iso_id, 'A.5.16', 'A.5',  'Identity management',                     'Full life cycle of identities shall be managed.', 'organizational', 'required', 1.5),
    (iso_id, 'A.5.17', 'A.5',  'Authentication information',              'Allocation and management of authentication information shall be controlled.', 'organizational', 'required', 1.5),
    (iso_id, 'A.5.19', 'A.5',  'Information security in supplier relationships', 'Processes and procedures to manage information security risks associated with use of suppliers shall be defined.', 'organizational', 'required', 1.0),
    (iso_id, 'A.5.24', 'A.5',  'Information security incident management planning', 'Information security incident management shall be planned by establishing, communicating, and applying appropriate processes.', 'organizational', 'required', 1.5),
    (iso_id, 'A.6.3',  'A.6',  'Information security awareness, education, and training', 'Personnel and relevant interested parties shall receive appropriate awareness, education, and training.', 'people', 'required', 1.0),
    (iso_id, 'A.8.5',  'A.8',  'Secure authentication',                   'Secure authentication technologies and procedures shall be implemented based on access restrictions and topic-specific policy.', 'technological', 'required', 1.5),
    (iso_id, 'A.8.13', 'A.8',  'Information backup',                      'Backup copies of information, software, and systems shall be maintained and regularly tested.', 'technological', 'required', 1.5),
    (iso_id, 'A.8.15', 'A.8',  'Logging',                                 'Logs that record activities, exceptions, faults, and other relevant events shall be produced, stored, protected, and analysed.', 'technological', 'required', 1.5),
    (iso_id, 'A.8.24', 'A.8',  'Use of cryptography',                     'Rules for the effective use of cryptography shall be defined and implemented.', 'technological', 'required', 1.5)
  on conflict (framework_id, citation) do nothing;

  -- GDPR Article 32 — security of processing
  insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight) values
    (gdpr_id, 'Art. 32(1)(a)', 'Art. 32', 'Pseudonymisation and encryption of personal data', 'The controller and processor shall implement appropriate technical and organisational measures including pseudonymisation and encryption.', 'technical', 'required', 1.5),
    (gdpr_id, 'Art. 32(1)(b)', 'Art. 32', 'Ongoing confidentiality, integrity, availability, and resilience', 'Ensure the ongoing confidentiality, integrity, availability and resilience of processing systems and services.', 'technical', 'required', 1.5),
    (gdpr_id, 'Art. 32(1)(c)', 'Art. 32', 'Restore the availability and access to personal data', 'Restore the availability and access to personal data in a timely manner in the event of a physical or technical incident.', 'technical', 'required', 1.5),
    (gdpr_id, 'Art. 32(1)(d)', 'Art. 32', 'Regular testing of effectiveness',         'Process for regularly testing, assessing and evaluating the effectiveness of technical and organisational measures.', 'technical', 'required', 1.0),
    (gdpr_id, 'Art. 32(4)',    'Art. 32', 'Personnel acting under authority',         'The controller and processor shall take steps to ensure that any natural person acting under their authority who has access to personal data does not process them except on instructions from the controller.', 'organizational', 'required', 1.0)
  on conflict (framework_id, citation) do nothing;
end $$;

-- ── Controls ────────────────────────────────────────────────────────────
-- The unified library. Each control is one safeguard; framework_mappings
-- below links it to every requirement it satisfies.
insert into controls (control_key, title, description, category, implementation_type, default_priority, healthcare_baseline, active) values
  ('ACC-001', 'MFA enforced for admin accounts',                      'Every account with admin or owner privileges requires multi-factor authentication (TOTP, hardware key, or platform-bound passkey). Enrollment is mandatory at first sign-in and verified on every privileged action.', 'identity', 'technical', 'critical', true, true),
  ('ACC-002', 'MFA enforced for all workforce accounts',              'All workforce members (including staff and contractors) authenticate with a second factor for any system that handles compliance evidence, intel, or workspace settings.', 'identity', 'technical', 'high', true, true),
  ('ACC-003', 'Unique account per workforce member',                  'No shared logins. Each workforce member has their own account so audit trails attribute actions to a single person.', 'identity', 'administrative', 'high', true, true),
  ('ACC-004', 'Access review every 90 days',                          'Owners and admins formally review every active membership, role assignment, and integration credential at least quarterly. Stale access is removed within 7 days of the review.', 'identity', 'administrative', 'high', true, true),
  ('ACC-005', 'Offboarding within 24 hours',                          'When a workforce member leaves or changes role, their access is revoked or downgraded within 24 hours. Offboarding events are logged in the audit trail.', 'identity', 'administrative', 'critical', true, true),
  ('ACC-006', 'Strong password requirements',                         'Passwords are at least 12 characters, screened against known breach corpora, and rotated only on compromise (no calendar rotation).', 'identity', 'technical', 'medium', true, true),

  ('CRY-001', 'Data encrypted at rest',                               'All workspace data is encrypted at rest using AES-256 (managed by the cloud provider or via app-level KMS).', 'cryptography', 'technical', 'critical', true, true),
  ('CRY-002', 'Data encrypted in transit',                            'All client and server traffic uses TLS 1.2 or higher. HSTS is enabled. Plaintext fallback is disabled.', 'cryptography', 'technical', 'critical', true, true),
  ('CRY-003', 'Integration credentials encrypted with separate key',  'OAuth tokens and API keys for integrations are encrypted with a key held outside the database (KMS or app-side env var) so a database leak alone does not expose credentials.', 'cryptography', 'technical', 'high', true, true),

  ('LOG-001', 'Append-only audit log of privileged actions',          'Every privileged action (role change, member removal, policy publish, integration connect, etc.) is recorded in an append-only audit log. RLS prevents modification.', 'audit_logging', 'technical', 'critical', true, true),
  ('LOG-002', 'Audit log retention of at least 12 months',            'Audit log entries are retained for 12 months minimum. Healthcare practices should retain for 6 years for HIPAA documentation requirements.', 'audit_logging', 'administrative', 'high', true, true),
  ('LOG-003', 'Tamper-evident integrity on audit records',            'Audit log rows are append-only at the RLS/database level. Optionally signed or hash-chained for forensic integrity.', 'audit_logging', 'technical', 'medium', true, true),

  ('VEN-001', 'BAA on file for every PHI-handling vendor',            'For every vendor that touches PHI, a current Business Associate Agreement is on file before any data flows. The BAA is tracked, dated, and renewed on schedule.', 'vendor', 'administrative', 'critical', true, true),
  ('VEN-002', 'Vendor risk assessment at onboarding and annually',    'Each vendor is assessed for security posture (questionnaire, SOC 2 report, ISO certificate) at onboarding and every 12 months.', 'vendor', 'administrative', 'high', true, true),
  ('VEN-003', 'BAA expiration alerts at 60 and 30 days',              'Automated alerts to the practice administrator at 60 and 30 days before any BAA expiration so renewal happens before lapse.', 'vendor', 'administrative', 'medium', true, true),

  ('INC-001', 'Incident response plan documented and tested',         'A written incident response plan defining roles, escalation, communication, and recovery is reviewed annually and tested at least once a year.', 'incident_response', 'administrative', 'critical', true, true),
  ('INC-002', 'Breach notification procedures meet HIPAA timelines',  'For PHI breaches, the practice notifies affected individuals within 60 days and HHS per the HIPAA breach notification rule.', 'incident_response', 'administrative', 'critical', true, true),
  ('INC-003', 'Security incident drills at least annually',           'Tabletop exercises or live drills are run at least once per year to validate the incident response plan and surface gaps.', 'incident_response', 'administrative', 'medium', true, true),

  ('BCK-001', 'Automated backups every 24 hours',                     'Production data is backed up at least daily. Backups are encrypted at rest and stored in a different region or availability zone.', 'continuity', 'technical', 'critical', true, true),
  ('BCK-002', 'Backup restoration tested quarterly',                  'A test restore of recent backups is performed quarterly. The test result is documented.', 'continuity', 'administrative', 'high', true, true),
  ('BCK-003', 'Disaster recovery plan with RTO and RPO',              'A documented disaster recovery plan defines target Recovery Time Objective (RTO) and Recovery Point Objective (RPO), tested annually.', 'continuity', 'administrative', 'high', true, true),

  ('TRN-001', 'Annual HIPAA security training for all workforce',     'Every workforce member completes HIPAA security awareness training annually. Completion is tracked with date and quiz score.', 'training', 'administrative', 'critical', true, true),
  ('TRN-002', 'Role-specific security training for admins and developers', 'Admins and developers receive role-specific training covering threat modeling, secure development, and incident response.', 'training', 'administrative', 'medium', true, true),
  ('TRN-003', 'Phishing simulation at least twice a year',            'Workforce members receive a simulated phishing email at least twice per year. Click rates are tracked; repeat clickers receive additional training.', 'training', 'administrative', 'medium', true, true),

  ('CHG-001', 'Change management for production systems',             'Every production change is reviewed by at least one other person before merge/deploy. Changes are logged with author, reviewer, and timestamp.', 'change_management', 'administrative', 'high', true, true),
  ('CHG-002', 'Separation of duties for high-risk operations',        'No single individual can both initiate and approve high-risk operations (production deploys, billing changes, member-role promotions to owner).', 'change_management', 'administrative', 'high', true, true),

  ('POL-001', 'Information security policy reviewed annually',        'A written information security policy exists, is reviewed and approved annually by leadership, and is acknowledged by every workforce member.', 'policy', 'administrative', 'high', true, true),
  ('POL-002', 'Acceptable use policy acknowledged by every member',   'An acceptable use policy is in place and acknowledged by every workforce member on hire and after any material change.', 'policy', 'administrative', 'medium', true, true),
  ('POL-003', 'Privacy policy meeting HIPAA Privacy Rule requirements', 'A Notice of Privacy Practices is in place and distributed per the HIPAA Privacy Rule.', 'policy', 'administrative', 'high', true, true),

  ('RSK-001', 'Risk assessment performed annually',                   'A formal risk assessment covering threats to PHI is performed at least once a year, with documented findings and remediation plan.', 'risk', 'administrative', 'critical', true, true),
  ('RSK-002', 'Risk register maintained and reviewed',                'Identified risks are tracked in a register with owner, severity, mitigation, and review cadence. Reviewed at least quarterly.', 'risk', 'administrative', 'high', true, true),

  ('PHY-001', 'Physical access controls for facilities housing PHI',  'Facilities housing systems with PHI use locks, badges, or other physical access controls. Visitor access is logged.', 'physical', 'physical', 'high', true, true),
  ('PHY-002', 'Workstation security in clinical areas',               'Workstations in clinical areas auto-lock after 5 minutes of inactivity and are positioned to prevent shoulder-surfing.', 'physical', 'physical', 'medium', true, true),
  ('PHY-003', 'Media disposal with secure wipe or destruction',       'Hardware and electronic media containing PHI is wiped via NIST SP 800-88 standard or physically destroyed before disposal.', 'physical', 'physical', 'medium', true, true)
on conflict (control_key) do nothing;

-- ── Framework mappings ─────────────────────────────────────────────────
-- This is the payoff: one control row maps to N framework requirements,
-- so "mark this safeguard compliant" updates every framework's score.
do $$
declare
  -- requirement IDs by framework_code + citation
  -- (lookup map populated inline below)

  -- helper: lookup a requirement id by code + citation
  reqid_hipaa_308a1i      uuid := (select id from framework_requirements where citation = '164.308(a)(1)(i)');
  reqid_hipaa_308a1iiA    uuid := (select id from framework_requirements where citation = '164.308(a)(1)(ii)(A)');
  reqid_hipaa_308a1iiB    uuid := (select id from framework_requirements where citation = '164.308(a)(1)(ii)(B)');
  reqid_hipaa_308a3i      uuid := (select id from framework_requirements where citation = '164.308(a)(3)(i)');
  reqid_hipaa_308a4i      uuid := (select id from framework_requirements where citation = '164.308(a)(4)(i)');
  reqid_hipaa_308a5i      uuid := (select id from framework_requirements where citation = '164.308(a)(5)(i)');
  reqid_hipaa_308a6i      uuid := (select id from framework_requirements where citation = '164.308(a)(6)(i)');
  reqid_hipaa_308a7i      uuid := (select id from framework_requirements where citation = '164.308(a)(7)(i)');
  reqid_hipaa_308a8       uuid := (select id from framework_requirements where citation = '164.308(a)(8)');
  reqid_hipaa_308b1       uuid := (select id from framework_requirements where citation = '164.308(b)(1)');
  reqid_hipaa_310a1       uuid := (select id from framework_requirements where citation = '164.310(a)(1)');
  reqid_hipaa_310d1       uuid := (select id from framework_requirements where citation = '164.310(d)(1)');
  reqid_hipaa_312a1       uuid := (select id from framework_requirements where citation = '164.312(a)(1)');
  reqid_hipaa_312a2iv     uuid := (select id from framework_requirements where citation = '164.312(a)(2)(iv)');
  reqid_hipaa_312b        uuid := (select id from framework_requirements where citation = '164.312(b)');
  reqid_hipaa_312c1       uuid := (select id from framework_requirements where citation = '164.312(c)(1)');
  reqid_hipaa_312d        uuid := (select id from framework_requirements where citation = '164.312(d)');
  reqid_hipaa_312e1       uuid := (select id from framework_requirements where citation = '164.312(e)(1)');
  reqid_soc2_cc11         uuid := (select id from framework_requirements where citation = 'CC1.1');
  reqid_soc2_cc21         uuid := (select id from framework_requirements where citation = 'CC2.1');
  reqid_soc2_cc51         uuid := (select id from framework_requirements where citation = 'CC5.1');
  reqid_soc2_cc52         uuid := (select id from framework_requirements where citation = 'CC5.2');
  reqid_soc2_cc61         uuid := (select id from framework_requirements where citation = 'CC6.1');
  reqid_soc2_cc66         uuid := (select id from framework_requirements where citation = 'CC6.6');
  reqid_soc2_cc67         uuid := (select id from framework_requirements where citation = 'CC6.7');
  reqid_soc2_cc68         uuid := (select id from framework_requirements where citation = 'CC6.8');
  reqid_soc2_cc71         uuid := (select id from framework_requirements where citation = 'CC7.1');
  reqid_soc2_cc72         uuid := (select id from framework_requirements where citation = 'CC7.2');
  reqid_soc2_cc73         uuid := (select id from framework_requirements where citation = 'CC7.3');
  reqid_soc2_cc74         uuid := (select id from framework_requirements where citation = 'CC7.4');
  reqid_soc2_cc75         uuid := (select id from framework_requirements where citation = 'CC7.5');
  reqid_soc2_cc81         uuid := (select id from framework_requirements where citation = 'CC8.1');
  reqid_soc2_cc91         uuid := (select id from framework_requirements where citation = 'CC9.1');
  reqid_soc2_cc92         uuid := (select id from framework_requirements where citation = 'CC9.2');
  reqid_iso_a51           uuid := (select id from framework_requirements where citation = 'A.5.1');
  reqid_iso_a515          uuid := (select id from framework_requirements where citation = 'A.5.15');
  reqid_iso_a516          uuid := (select id from framework_requirements where citation = 'A.5.16');
  reqid_iso_a517          uuid := (select id from framework_requirements where citation = 'A.5.17');
  reqid_iso_a519          uuid := (select id from framework_requirements where citation = 'A.5.19');
  reqid_iso_a524          uuid := (select id from framework_requirements where citation = 'A.5.24');
  reqid_iso_a63           uuid := (select id from framework_requirements where citation = 'A.6.3');
  reqid_iso_a85           uuid := (select id from framework_requirements where citation = 'A.8.5');
  reqid_iso_a813          uuid := (select id from framework_requirements where citation = 'A.8.13');
  reqid_iso_a815          uuid := (select id from framework_requirements where citation = 'A.8.15');
  reqid_iso_a824          uuid := (select id from framework_requirements where citation = 'A.8.24');
  reqid_gdpr_32_1a        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(a)');
  reqid_gdpr_32_1b        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(b)');
  reqid_gdpr_32_1c        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(c)');
  reqid_gdpr_32_1d        uuid := (select id from framework_requirements where citation = 'Art. 32(1)(d)');
  reqid_gdpr_32_4         uuid := (select id from framework_requirements where citation = 'Art. 32(4)');

  -- Control IDs by key
  ctrl_acc001 uuid := (select id from controls where control_key = 'ACC-001');
  ctrl_acc002 uuid := (select id from controls where control_key = 'ACC-002');
  ctrl_acc003 uuid := (select id from controls where control_key = 'ACC-003');
  ctrl_acc004 uuid := (select id from controls where control_key = 'ACC-004');
  ctrl_acc005 uuid := (select id from controls where control_key = 'ACC-005');
  ctrl_acc006 uuid := (select id from controls where control_key = 'ACC-006');
  ctrl_cry001 uuid := (select id from controls where control_key = 'CRY-001');
  ctrl_cry002 uuid := (select id from controls where control_key = 'CRY-002');
  ctrl_cry003 uuid := (select id from controls where control_key = 'CRY-003');
  ctrl_log001 uuid := (select id from controls where control_key = 'LOG-001');
  ctrl_log002 uuid := (select id from controls where control_key = 'LOG-002');
  ctrl_log003 uuid := (select id from controls where control_key = 'LOG-003');
  ctrl_ven001 uuid := (select id from controls where control_key = 'VEN-001');
  ctrl_ven002 uuid := (select id from controls where control_key = 'VEN-002');
  ctrl_ven003 uuid := (select id from controls where control_key = 'VEN-003');
  ctrl_inc001 uuid := (select id from controls where control_key = 'INC-001');
  ctrl_inc002 uuid := (select id from controls where control_key = 'INC-002');
  ctrl_inc003 uuid := (select id from controls where control_key = 'INC-003');
  ctrl_bck001 uuid := (select id from controls where control_key = 'BCK-001');
  ctrl_bck002 uuid := (select id from controls where control_key = 'BCK-002');
  ctrl_bck003 uuid := (select id from controls where control_key = 'BCK-003');
  ctrl_trn001 uuid := (select id from controls where control_key = 'TRN-001');
  ctrl_trn002 uuid := (select id from controls where control_key = 'TRN-002');
  ctrl_trn003 uuid := (select id from controls where control_key = 'TRN-003');
  ctrl_chg001 uuid := (select id from controls where control_key = 'CHG-001');
  ctrl_chg002 uuid := (select id from controls where control_key = 'CHG-002');
  ctrl_pol001 uuid := (select id from controls where control_key = 'POL-001');
  ctrl_pol002 uuid := (select id from controls where control_key = 'POL-002');
  ctrl_pol003 uuid := (select id from controls where control_key = 'POL-003');
  ctrl_rsk001 uuid := (select id from controls where control_key = 'RSK-001');
  ctrl_rsk002 uuid := (select id from controls where control_key = 'RSK-002');
  ctrl_phy001 uuid := (select id from controls where control_key = 'PHY-001');
  ctrl_phy002 uuid := (select id from controls where control_key = 'PHY-002');
  ctrl_phy003 uuid := (select id from controls where control_key = 'PHY-003');
begin
  -- ACC-001 MFA for admins → 4 frameworks
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc001, reqid_hipaa_312d,    'fully_satisfies'),
    (ctrl_acc001, reqid_hipaa_312a1,   'partially_satisfies'),
    (ctrl_acc001, reqid_soc2_cc61,     'fully_satisfies'),
    (ctrl_acc001, reqid_iso_a516,      'fully_satisfies'),
    (ctrl_acc001, reqid_iso_a85,       'fully_satisfies'),
    (ctrl_acc001, reqid_gdpr_32_1b,    'partially_satisfies')
  on conflict do nothing;

  -- ACC-002 MFA for workforce → 3 frameworks
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc002, reqid_hipaa_312d,    'fully_satisfies'),
    (ctrl_acc002, reqid_soc2_cc66,     'fully_satisfies'),
    (ctrl_acc002, reqid_iso_a85,       'fully_satisfies')
  on conflict do nothing;

  -- ACC-003 Unique accounts
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc003, reqid_hipaa_312a1,   'partially_satisfies'),
    (ctrl_acc003, reqid_soc2_cc61,     'partially_satisfies'),
    (ctrl_acc003, reqid_iso_a516,      'fully_satisfies')
  on conflict do nothing;

  -- ACC-004 Quarterly access review
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc004, reqid_hipaa_308a4i,  'fully_satisfies'),
    (ctrl_acc004, reqid_hipaa_308a8,   'partially_satisfies'),
    (ctrl_acc004, reqid_soc2_cc61,     'partially_satisfies'),
    (ctrl_acc004, reqid_iso_a515,      'fully_satisfies')
  on conflict do nothing;

  -- ACC-005 Offboarding
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc005, reqid_hipaa_308a3i,  'fully_satisfies'),
    (ctrl_acc005, reqid_hipaa_308a4i,  'partially_satisfies'),
    (ctrl_acc005, reqid_soc2_cc61,     'partially_satisfies'),
    (ctrl_acc005, reqid_iso_a516,      'fully_satisfies')
  on conflict do nothing;

  -- ACC-006 Passwords
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_acc006, reqid_hipaa_312d,    'partially_satisfies'),
    (ctrl_acc006, reqid_iso_a517,      'fully_satisfies')
  on conflict do nothing;

  -- CRY-001 Encryption at rest
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_cry001, reqid_hipaa_312a2iv, 'fully_satisfies'),
    (ctrl_cry001, reqid_iso_a824,      'fully_satisfies'),
    (ctrl_cry001, reqid_gdpr_32_1a,    'fully_satisfies')
  on conflict do nothing;

  -- CRY-002 Encryption in transit
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_cry002, reqid_hipaa_312e1,   'fully_satisfies'),
    (ctrl_cry002, reqid_iso_a824,      'fully_satisfies'),
    (ctrl_cry002, reqid_gdpr_32_1a,    'fully_satisfies'),
    (ctrl_cry002, reqid_soc2_cc67,     'partially_satisfies')
  on conflict do nothing;

  -- CRY-003 Integration credential encryption
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_cry003, reqid_hipaa_312a2iv, 'partially_satisfies'),
    (ctrl_cry003, reqid_iso_a824,      'partially_satisfies'),
    (ctrl_cry003, reqid_gdpr_32_1a,    'partially_satisfies')
  on conflict do nothing;

  -- LOG-001 Audit log
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_log001, reqid_hipaa_312b,    'fully_satisfies'),
    (ctrl_log001, reqid_soc2_cc71,     'fully_satisfies'),
    (ctrl_log001, reqid_soc2_cc72,     'fully_satisfies'),
    (ctrl_log001, reqid_iso_a815,      'fully_satisfies')
  on conflict do nothing;

  -- LOG-002 Retention
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_log002, reqid_hipaa_312b,    'partially_satisfies'),
    (ctrl_log002, reqid_iso_a815,      'partially_satisfies')
  on conflict do nothing;

  -- LOG-003 Integrity
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_log003, reqid_hipaa_312c1,   'fully_satisfies'),
    (ctrl_log003, reqid_iso_a815,      'partially_satisfies')
  on conflict do nothing;

  -- VEN-001 BAA
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_ven001, reqid_hipaa_308b1,   'fully_satisfies'),
    (ctrl_ven001, reqid_iso_a519,      'partially_satisfies'),
    (ctrl_ven001, reqid_soc2_cc92,     'partially_satisfies')
  on conflict do nothing;

  -- VEN-002 Risk assessment
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_ven002, reqid_soc2_cc92,     'fully_satisfies'),
    (ctrl_ven002, reqid_iso_a519,      'fully_satisfies'),
    (ctrl_ven002, reqid_hipaa_308b1,   'partially_satisfies')
  on conflict do nothing;

  -- VEN-003 BAA expiration alerts
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_ven003, reqid_hipaa_308b1,   'partially_satisfies'),
    (ctrl_ven003, reqid_iso_a519,      'partially_satisfies')
  on conflict do nothing;

  -- INC-001 IR plan
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_inc001, reqid_hipaa_308a6i,  'fully_satisfies'),
    (ctrl_inc001, reqid_soc2_cc74,     'fully_satisfies'),
    (ctrl_inc001, reqid_iso_a524,      'fully_satisfies')
  on conflict do nothing;

  -- INC-002 Breach notification
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_inc002, reqid_hipaa_308a6i,  'fully_satisfies'),
    (ctrl_inc002, reqid_iso_a524,      'partially_satisfies')
  on conflict do nothing;

  -- INC-003 Drills
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_inc003, reqid_hipaa_308a8,   'partially_satisfies'),
    (ctrl_inc003, reqid_soc2_cc74,     'partially_satisfies'),
    (ctrl_inc003, reqid_iso_a524,      'partially_satisfies')
  on conflict do nothing;

  -- BCK-001 Backups
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_bck001, reqid_hipaa_308a7i,  'fully_satisfies'),
    (ctrl_bck001, reqid_iso_a813,      'fully_satisfies'),
    (ctrl_bck001, reqid_gdpr_32_1c,    'fully_satisfies'),
    (ctrl_bck001, reqid_soc2_cc75,     'partially_satisfies')
  on conflict do nothing;

  -- BCK-002 Restore tests
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_bck002, reqid_hipaa_308a7i,  'partially_satisfies'),
    (ctrl_bck002, reqid_iso_a813,      'fully_satisfies'),
    (ctrl_bck002, reqid_gdpr_32_1d,    'partially_satisfies')
  on conflict do nothing;

  -- BCK-003 DR
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_bck003, reqid_hipaa_308a7i,  'fully_satisfies'),
    (ctrl_bck003, reqid_soc2_cc75,     'fully_satisfies'),
    (ctrl_bck003, reqid_gdpr_32_1c,    'fully_satisfies')
  on conflict do nothing;

  -- TRN-001 Annual training
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_trn001, reqid_hipaa_308a5i,  'fully_satisfies'),
    (ctrl_trn001, reqid_iso_a63,       'fully_satisfies'),
    (ctrl_trn001, reqid_soc2_cc21,     'partially_satisfies')
  on conflict do nothing;

  -- TRN-002 Role-specific training
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_trn002, reqid_hipaa_308a5i,  'partially_satisfies'),
    (ctrl_trn002, reqid_iso_a63,       'partially_satisfies')
  on conflict do nothing;

  -- TRN-003 Phishing
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_trn003, reqid_hipaa_308a5i,  'partially_satisfies'),
    (ctrl_trn003, reqid_iso_a63,       'partially_satisfies'),
    (ctrl_trn003, reqid_soc2_cc68,     'partially_satisfies')
  on conflict do nothing;

  -- CHG-001 Change management
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_chg001, reqid_soc2_cc81,     'fully_satisfies'),
    (ctrl_chg001, reqid_soc2_cc52,     'partially_satisfies')
  on conflict do nothing;

  -- CHG-002 Separation of duties
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_chg002, reqid_soc2_cc51,     'fully_satisfies'),
    (ctrl_chg002, reqid_iso_a515,      'partially_satisfies')
  on conflict do nothing;

  -- POL-001 Info sec policy
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_pol001, reqid_hipaa_308a1i,  'fully_satisfies'),
    (ctrl_pol001, reqid_soc2_cc11,     'fully_satisfies'),
    (ctrl_pol001, reqid_iso_a51,       'fully_satisfies')
  on conflict do nothing;

  -- POL-002 AUP
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_pol002, reqid_hipaa_308a3i,  'partially_satisfies'),
    (ctrl_pol002, reqid_iso_a51,       'partially_satisfies'),
    (ctrl_pol002, reqid_gdpr_32_4,     'fully_satisfies')
  on conflict do nothing;

  -- POL-003 Privacy policy
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_pol003, reqid_hipaa_308a1i,  'partially_satisfies'),
    (ctrl_pol003, reqid_iso_a51,       'partially_satisfies')
  on conflict do nothing;

  -- RSK-001 Risk assessment
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_rsk001, reqid_hipaa_308a1iiA, 'fully_satisfies'),
    (ctrl_rsk001, reqid_hipaa_308a8,    'fully_satisfies'),
    (ctrl_rsk001, reqid_soc2_cc91,      'fully_satisfies'),
    (ctrl_rsk001, reqid_iso_a51,        'partially_satisfies'),
    (ctrl_rsk001, reqid_gdpr_32_1d,     'fully_satisfies')
  on conflict do nothing;

  -- RSK-002 Risk register
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_rsk002, reqid_hipaa_308a1iiB, 'fully_satisfies'),
    (ctrl_rsk002, reqid_soc2_cc91,      'partially_satisfies'),
    (ctrl_rsk002, reqid_iso_a51,        'partially_satisfies')
  on conflict do nothing;

  -- PHY-001 Facility access
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_phy001, reqid_hipaa_310a1,   'fully_satisfies'),
    (ctrl_phy001, reqid_iso_a515,      'partially_satisfies')
  on conflict do nothing;

  -- PHY-002 Workstation
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_phy002, reqid_hipaa_310a1,   'partially_satisfies'),
    (ctrl_phy002, reqid_soc2_cc61,     'partially_satisfies')
  on conflict do nothing;

  -- PHY-003 Media disposal
  insert into framework_mappings (control_id, framework_requirement_id, mapping_strength) values
    (ctrl_phy003, reqid_hipaa_310d1,   'fully_satisfies'),
    (ctrl_phy003, reqid_iso_a515,      'partially_satisfies')
  on conflict do nothing;
end $$;

-- ── Remediation guidance ────────────────────────────────────────────────
-- One row per control for the most common severity. Adds practical "here's
-- how to fix this" steps to every control. Extend over time per integration.
do $$
declare
  ctrl record;
  guidance jsonb := jsonb_build_array(
    jsonb_build_object('key', 'ACC-001', 'eff', 60, 'sev', 'critical', 'md',  'Enforce MFA on every admin account before granting privileged access.\n\n1. Choose a second-factor type: TOTP (free, works with Authenticator apps), hardware key (YubiKey), or platform-bound passkey (cross-device).\n2. In your identity provider (Supabase, Okta, Microsoft Entra), enable MFA enforcement for accounts with admin or owner roles.\n3. Communicate the change to your admin users one week in advance.\n4. Audit weekly: any privileged account without MFA enrolled should be temporarily downgraded until enrollment completes.'),
    jsonb_build_object('key', 'ACC-002', 'eff', 120, 'sev', 'high',     'md',  'Extend MFA enforcement to every workforce member, not just admins.\n\n1. Identify all accounts with access to PHI-handling systems.\n2. Roll out MFA enrollment to those accounts in waves (admins first, clinicians second, support staff third).\n3. Provide a backup factor (one-time codes printed and stored securely) so an unavailable phone does not lock out a clinical workflow.'),
    jsonb_build_object('key', 'ACC-003', 'eff', 30, 'sev', 'high',     'md',  'Eliminate every shared login.\n\n1. Audit all systems for credentials shared across two or more individuals.\n2. Create individual accounts and migrate work onto them.\n3. Document the policy in your acceptable-use policy with explicit prohibition of credential sharing.'),
    jsonb_build_object('key', 'ACC-004', 'eff', 90, 'sev', 'high',     'md',  'Implement a 90-day access review cadence.\n\n1. Pick a calendar quarter cadence.\n2. Export the list of active accounts + roles per system.\n3. Owner/admin reviews each line and confirms or revokes.\n4. Record the review date + reviewer in your audit log.\n5. Stale access (any "revoke" decision) is implemented within 7 days.'),
    jsonb_build_object('key', 'ACC-005', 'eff', 30, 'sev', 'critical',  'md',  'Build a 24-hour offboarding standard.\n\n1. HR or practice admin signals departure or role change.\n2. Standard runbook: identity provider account disabled, integrations OAuth revoked, MFA factors removed, audit log entry written.\n3. Target SLA: 24 hours from notice.\n4. Track adherence in a monthly metric.'),
    jsonb_build_object('key', 'ACC-006', 'eff', 20, 'sev', 'medium',   'md',  'Adopt modern password policy.\n\n1. Minimum 12 characters, no required character classes.\n2. Screen against the HaveIBeenPwned API on creation.\n3. Drop calendar-based rotation; rotate only on suspected compromise.\n4. Encourage password managers.'),
    jsonb_build_object('key', 'CRY-001', 'eff', 60, 'sev', 'critical', 'md',  'Confirm at-rest encryption across all storage.\n\n1. Database: Supabase encrypts at rest by default — confirm in dashboard.\n2. Object storage (S3, Supabase Storage): enable bucket-level encryption.\n3. Backups: confirm encryption flag.\n4. Any local-disk persisted data on workstations: enable BitLocker or FileVault.'),
    jsonb_build_object('key', 'CRY-002', 'eff', 30, 'sev', 'critical', 'md',  'Enforce TLS 1.2+ end-to-end.\n\n1. Vercel + Supabase enforce TLS by default — verify in DNS.\n2. Add HSTS header (we ship this in next.config.mjs).\n3. Disable any plaintext fallback in integration endpoints.\n4. Periodically scan with testssl.sh or ssllabs.'),
    jsonb_build_object('key', 'CRY-003', 'eff', 90, 'sev', 'high',     'md',  'Encrypt integration credentials with a separate key.\n\n1. Generate a 64-char hex secret as CREDENTIAL_KMS_KEY.\n2. Store it in Vercel env vars (production) and .env.local (dev).\n3. Use lib/security/credentials.ts to read and write integration OAuth tokens.\n4. Rotate the key annually: re-encrypt all rows with the new key, then delete the old.'),
    jsonb_build_object('key', 'LOG-001', 'eff', 30, 'sev', 'critical', 'md',  'Audit log every privileged action.\n\n1. Use the audit_logs table (already in place).\n2. Every server handler that mutates state writes one entry: action, resource_type, resource_id, metadata.\n3. RLS prevents UPDATE/DELETE on audit_logs — append-only by construction.'),
    jsonb_build_object('key', 'LOG-002', 'eff', 60, 'sev', 'high',     'md',  'Keep audit logs for 6 years (HIPAA documentation requirement).\n\n1. Confirm Supabase retains data per your plan.\n2. For long retention, periodically export to S3 Glacier or equivalent cold storage.\n3. Document the retention period in your privacy policy.'),
    jsonb_build_object('key', 'LOG-003', 'eff', 240, 'sev', 'medium',   'md',  'Add tamper-evidence to the audit log.\n\n1. Hash each row using SHA-256(prev_hash || row).\n2. Periodically anchor the latest hash to an external source (transparency log, blockchain, signed by a private key in cold storage).\n3. Verify integrity in your annual evaluation.'),
    jsonb_build_object('key', 'VEN-001', 'eff', 480, 'sev', 'critical', 'md',  'BAA every vendor that touches PHI.\n\n1. List every vendor your practice uses (EHR, billing, lab, cloud, etc.).\n2. Identify which touch PHI.\n3. Sign a BAA with each before any data flows; renew on schedule.\n4. Use Fortify''s Vendors page to track signed dates and expirations.'),
    jsonb_build_object('key', 'VEN-002', 'eff', 240, 'sev', 'high',     'md',  'Assess every vendor at onboarding and annually.\n\n1. Send a security questionnaire (SIG, CAIQ, or your own).\n2. Request their SOC 2 report or ISO certificate.\n3. Score each vendor and re-assess yearly.\n4. Tag high-risk vendors for closer monitoring.'),
    jsonb_build_object('key', 'VEN-003', 'eff', 30, 'sev', 'medium',   'md',  'Set up automated BAA expiration alerts.\n\n1. Use Fortify''s built-in alerts (60-day + 30-day).\n2. Assign an owner for renewal.\n3. Calendar reviews so renewal happens before lapse.'),
    jsonb_build_object('key', 'INC-001', 'eff', 480, 'sev', 'critical', 'md',  'Write and adopt a documented incident response plan.\n\n1. Define roles: incident commander, communications lead, technical lead.\n2. Escalation paths and external contacts (counsel, cyber insurance, FBI, HHS).\n3. Communication templates for affected individuals.\n4. Review annually; test at least once a year.'),
    jsonb_build_object('key', 'INC-002', 'eff', 120, 'sev', 'critical', 'md',  'Comply with HIPAA Breach Notification Rule timelines.\n\n1. For breaches affecting <500 individuals: notify affected individuals within 60 days, HHS within 60 days of year-end.\n2. For breaches affecting 500+: notify affected individuals + HHS + media within 60 days.\n3. Bake these timelines into your incident response playbook.'),
    jsonb_build_object('key', 'INC-003', 'eff', 240, 'sev', 'medium',   'md',  'Tabletop exercise at least annually.\n\n1. Pick a realistic scenario (ransomware, phishing-led credential theft, lost laptop).\n2. Walk through the plan with the team.\n3. Document gaps and update the plan.\n4. Optional: pen-test or red-team for higher rigor.'),
    jsonb_build_object('key', 'BCK-001', 'eff', 60, 'sev', 'critical', 'md',  'Verify daily automated backups.\n\n1. Supabase backups: confirm scheduled, encrypted.\n2. Storage: confirm versioning and lifecycle.\n3. Test restore quarterly (see BCK-002).'),
    jsonb_build_object('key', 'BCK-002', 'eff', 120, 'sev', 'high',     'md',  'Quarterly restore drills.\n\n1. Pull a recent backup.\n2. Restore to a non-production environment.\n3. Verify the restored data integrity.\n4. Document the drill in your evidence log.'),
    jsonb_build_object('key', 'BCK-003', 'eff', 480, 'sev', 'high',     'md',  'Define RTO and RPO in a written DR plan.\n\n1. Recovery Time Objective: how long can the practice be down?\n2. Recovery Point Objective: how much data can you afford to lose?\n3. Document in a DR plan reviewed annually.\n4. Test the plan at least once a year.'),
    jsonb_build_object('key', 'TRN-001', 'eff', 240, 'sev', 'critical', 'md',  'Annual HIPAA security training for every workforce member.\n\n1. Use Fortify''s training modules or an external provider.\n2. Track completion date and quiz score per workforce member.\n3. Re-train within 30 days of any major policy change.'),
    jsonb_build_object('key', 'TRN-002', 'eff', 240, 'sev', 'medium',   'md',  'Role-specific training for admins and developers.\n\n1. Admins: privileged access management, incident triage.\n2. Developers: secure coding, threat modeling, dependency management.\n3. Document completion.'),
    jsonb_build_object('key', 'TRN-003', 'eff', 120, 'sev', 'medium',   'md',  'Phishing simulation at least twice per year.\n\n1. Use an external phishing-as-a-service vendor or run with internal tooling.\n2. Track click rate by department.\n3. Repeat clickers receive additional training.'),
    jsonb_build_object('key', 'CHG-001', 'eff', 60, 'sev', 'high',     'md',  'Require code review on every production change.\n\n1. Branch protection on main: require at least one reviewer.\n2. Required CI checks (typecheck, tests, build).\n3. Document approvers in commit metadata.'),
    jsonb_build_object('key', 'CHG-002', 'eff', 30, 'sev', 'high',     'md',  'Enforce separation of duties for high-risk operations.\n\n1. Production deploys require both author and approver.\n2. Member-role promotion to owner requires existing owner to act.\n3. Billing changes are owner-only.\n4. Document in your acceptable-use policy.'),
    jsonb_build_object('key', 'POL-001', 'eff', 480, 'sev', 'high',     'md',  'Write and adopt an information security policy.\n\n1. Use Fortify''s AI policy drafter as a starting point.\n2. Have leadership review and sign.\n3. Communicate to every workforce member; collect acknowledgements.\n4. Review annually.'),
    jsonb_build_object('key', 'POL-002', 'eff', 240, 'sev', 'medium',   'md',  'Write and adopt an acceptable use policy.\n\n1. Cover device usage, credential handling, social media, AI tools.\n2. Workforce acknowledges on hire and after any material update.'),
    jsonb_build_object('key', 'POL-003', 'eff', 240, 'sev', 'high',     'md',  'Maintain a Notice of Privacy Practices meeting HIPAA Privacy Rule.\n\n1. Distribute to patients at first encounter.\n2. Post on your public website.\n3. Update when practices change.'),
    jsonb_build_object('key', 'RSK-001', 'eff', 480, 'sev', 'critical', 'md',  'Perform a formal annual risk assessment.\n\n1. Use Fortify''s risk-assessment wizard (5-minute version).\n2. For higher rigor, follow NIST SP 800-30.\n3. Document findings, owner, and remediation plan.'),
    jsonb_build_object('key', 'RSK-002', 'eff', 60, 'sev', 'high',     'md',  'Maintain a risk register.\n\n1. Track each identified risk: severity, owner, mitigation, status.\n2. Review at least quarterly.\n3. Close risks only when mitigation is verified.'),
    jsonb_build_object('key', 'PHY-001', 'eff', 240, 'sev', 'high',     'md',  'Implement facility access controls for any space housing PHI systems.\n\n1. Locks, badges, or other entry control on doors.\n2. Visitor logs.\n3. Camera coverage for entry points.\n4. Document the controls.'),
    jsonb_build_object('key', 'PHY-002', 'eff', 60, 'sev', 'medium',   'md',  'Lock workstations in clinical areas.\n\n1. 5-minute idle auto-lock (Windows Group Policy or macOS configuration profile).\n2. Privacy screens where shoulder-surfing is a risk.\n3. Reinforced via training.'),
    jsonb_build_object('key', 'PHY-003', 'eff', 60, 'sev', 'medium',   'md',  'Secure media disposal.\n\n1. Wipe per NIST SP 800-88 standard (or physically destroy).\n2. Use a certified disposal vendor for end-of-life equipment.\n3. Keep a chain-of-custody log for destroyed media containing PHI.')
  );
  g jsonb;
  c uuid;
begin
  for g in select * from jsonb_array_elements(guidance) loop
    c := (select id from controls where control_key = g->>'key');
    if c is not null then
      insert into remediation_guidance (control_id, severity, title, step_by_step_markdown, estimated_effort_minutes, ai_generated)
      values (c, g->>'sev', (select title from controls where id = c), g->>'md', (g->>'eff')::int, false)
      on conflict do nothing;
    end if;
  end loop;
end $$;
