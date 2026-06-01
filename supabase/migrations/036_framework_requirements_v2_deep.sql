-- 036_framework_requirements_v2_deep.sql
-- Compliance library v2 — framework_requirements depth pass.
--
-- Adds ~100 new requirement rows across HIPAA, SOC 2 (all 5 TSCs),
-- ISO 27001:2022 Annex A (all 4 categories), and GDPR. Every row carries:
--   - exact citation
--   - parent citation (for tree rollups)
--   - obligation_type (required / addressable / recommended)
--   - weight (for the readiness RPC)
--   - source_url + source_type (provenance)
--   - is_official_language flag
--
-- This is the foundational layer. Controls + mappings + remediation
-- playbooks built on top in migrations 037+.

do $$
declare
  hipaa_id uuid := (select id from frameworks where code = 'HIPAA');
  soc2_id  uuid := (select id from frameworks where code = 'SOC2');
  iso_id   uuid := (select id from frameworks where code = 'ISO27001');
  gdpr_id  uuid := (select id from frameworks where code = 'GDPR');
  hipaa_url text := 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164';
  breach_url text := 'https://www.hhs.gov/hipaa/for-professionals/breach-notification/';
  soc2_url  text := 'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2';
  iso_url   text := 'https://www.iso.org/standard/27001';
  gdpr_url  text := 'https://gdpr-info.eu/';
begin

-- ════════════════════════════════════════════════════════════════════
-- HIPAA — full Administrative + Physical + Technical safeguard depth +
--         organizational + documentation + breach + privacy basics
-- ════════════════════════════════════════════════════════════════════
insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight, source_url, source_type) values
  (hipaa_id, '164.308(a)(2)',         '164.308(a)',    'Assigned Security Responsibility',     'Identify the Security Official responsible for development and implementation of the policies and procedures required by the Security Rule.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(3)(ii)(A)',  '164.308(a)(3)', 'Authorization and/or Supervision',     'Implement procedures for the authorization and/or supervision of workforce members who work with ePHI or in locations where it might be accessed.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(3)(ii)(B)',  '164.308(a)(3)', 'Workforce Clearance Procedure',        'Implement procedures to determine that the access of a workforce member to ePHI is appropriate.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(3)(ii)(C)',  '164.308(a)(3)', 'Termination Procedures',               'Implement procedures for terminating access to ePHI when employment ends or as required by clearance procedures.', 'admin', 'addressable', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(4)(ii)(B)',  '164.308(a)(4)', 'Access Authorization',                 'Implement policies and procedures for granting access to ePHI through a workstation, transaction, program, process, or other mechanism.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(4)(ii)(C)',  '164.308(a)(4)', 'Access Establishment and Modification','Implement policies and procedures that, based upon the entity''s access authorization policies, establish, document, review, and modify a user''s right of access to a workstation, transaction, program, or process.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(5)(ii)(A)',  '164.308(a)(5)', 'Security Reminders',                   'Periodic security updates for workforce members.', 'admin', 'addressable', 0.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(5)(ii)(B)',  '164.308(a)(5)', 'Protection from Malicious Software',   'Procedures for guarding against, detecting, and reporting malicious software.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(5)(ii)(C)',  '164.308(a)(5)', 'Log-in Monitoring',                    'Procedures for monitoring log-in attempts and reporting discrepancies.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(5)(ii)(D)',  '164.308(a)(5)', 'Password Management',                  'Procedures for creating, changing, and safeguarding passwords.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(6)(ii)',     '164.308(a)(6)', 'Response and Reporting',               'Identify and respond to suspected or known security incidents; mitigate harmful effects; document incidents and outcomes.', 'admin', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(7)(ii)(A)',  '164.308(a)(7)', 'Data Backup Plan',                     'Establish and implement procedures to create and maintain retrievable exact copies of ePHI.', 'admin', 'required', 2.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(7)(ii)(B)',  '164.308(a)(7)', 'Disaster Recovery Plan',               'Establish and implement procedures to restore any loss of data.', 'admin', 'required', 2.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(7)(ii)(C)',  '164.308(a)(7)', 'Emergency Mode Operation Plan',        'Procedures to enable continuation of critical business processes for protection of ePHI during emergency mode operation.', 'admin', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(7)(ii)(D)',  '164.308(a)(7)', 'Testing and Revision Procedures',      'Implement procedures for periodic testing and revision of contingency plans.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.308(a)(7)(ii)(E)',  '164.308(a)(7)', 'Applications and Data Criticality Analysis', 'Assess the relative criticality of specific applications and data in support of other contingency plan components.', 'admin', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(a)(2)(i)',      '164.310(a)',    'Contingency Operations',               'Procedures that allow facility access in support of restoration of lost data under the disaster recovery plan.', 'physical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(a)(2)(ii)',     '164.310(a)',    'Facility Security Plan',               'Policies and procedures to safeguard the facility and the equipment from unauthorized physical access, tampering, and theft.', 'physical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(a)(2)(iii)',    '164.310(a)',    'Access Control and Validation Procedures', 'Procedures to control and validate a person''s access to facilities based on their role or function.', 'physical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(a)(2)(iv)',     '164.310(a)',    'Maintenance Records',                  'Document repairs and modifications to the physical components of a facility related to security.', 'physical', 'addressable', 0.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(b)',            '164.310',       'Workstation Use',                      'Policies and procedures that specify the proper functions, manner of performance, and physical attributes of the surroundings of a specific workstation or class of workstations.', 'physical', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(c)',            '164.310',       'Workstation Security',                 'Implement physical safeguards for all workstations that access ePHI.', 'physical', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(d)(2)(i)',      '164.310(d)',    'Disposal',                             'Policies and procedures to address the final disposition of ePHI, and/or the hardware or media on which it is stored.', 'physical', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(d)(2)(ii)',     '164.310(d)',    'Media Re-use',                         'Procedures for removal of ePHI from electronic media before the media are made available for re-use.', 'physical', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(d)(2)(iii)',    '164.310(d)',    'Accountability',                       'Maintain a record of the movements of hardware and electronic media and any person responsible therefore.', 'physical', 'addressable', 0.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.310(d)(2)(iv)',     '164.310(d)',    'Data Backup and Storage',              'Create a retrievable, exact copy of ePHI, when needed, before movement of equipment.', 'physical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.312(a)(2)(i)',      '164.312(a)',    'Unique User Identification',           'Assign a unique name and/or number for identifying and tracking user identity.', 'technical', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.312(a)(2)(ii)',     '164.312(a)',    'Emergency Access Procedure',           'Establish procedures for obtaining necessary ePHI during an emergency.', 'technical', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.312(a)(2)(iii)',    '164.312(a)',    'Automatic Logoff',                     'Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.', 'technical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.312(e)(2)(i)',      '164.312(e)',    'Integrity Controls — Transmission',    'Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection.', 'technical', 'addressable', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.312(e)(2)(ii)',     '164.312(e)',    'Encryption — Transmission',            'Implement a mechanism to encrypt ePHI whenever deemed appropriate during transmission.', 'technical', 'addressable', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.314(a)(1)',         '164.314',       'Business Associate Contracts (Organizational)', 'The contract between a covered entity and its business associate must meet the requirements specified in 164.314 as well as 164.308(b).', 'admin', 'required', 1.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.316(a)',            '164.316',       'Policies and Procedures',              'Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, or other requirements of this subpart.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.316(b)(1)',         '164.316(b)',    'Documentation',                        'Maintain the policies and procedures implemented to comply with this subpart in written (which may be electronic) form.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.316(b)(2)(i)',      '164.316(b)',    'Documentation Retention (6 years)',    'Retain documentation required by this subpart for 6 years from the date of its creation or the date when it last was in effect.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.316(b)(2)(ii)',     '164.316(b)',    'Documentation Availability',           'Make documentation available to those persons responsible for implementing the procedures.', 'admin', 'required', 0.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.316(b)(2)(iii)',    '164.316(b)',    'Documentation Updates',                'Review documentation periodically and update as needed in response to environmental or operational changes.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.402',               '164.402',       'Breach — Definitions',                 'Definitions applicable to the Breach Notification Rule, including what constitutes a breach and risk assessment factors.', 'admin', 'required', 0.5, breach_url, 'regulation'),
  (hipaa_id, '164.406',               '164.406',       'Notification to the Media',            'Notify prominent media outlets serving a State or jurisdiction following discovery of a breach affecting 500 or more residents of that State or jurisdiction.', 'admin', 'required', 1.0, breach_url, 'regulation'),
  (hipaa_id, '164.410',               '164.410',       'Notification by a Business Associate', 'A business associate shall, following the discovery of a breach of unsecured PHI, notify the covered entity of such breach.', 'admin', 'required', 1.0, breach_url, 'regulation'),
  (hipaa_id, '164.412',               '164.412',       'Law Enforcement Delay',                'Delay of notification to comply with law enforcement requests must be supported by statement.', 'admin', 'recommended', 0.5, breach_url, 'regulation'),
  (hipaa_id, '164.414',               '164.414',       'Administrative Requirements (Breach)', 'A covered entity must comply with administrative requirements regarding breach training, complaint process, sanction policy, and prohibition on retaliation.', 'admin', 'required', 1.0, breach_url, 'regulation'),
  (hipaa_id, '164.530(c)',            '164.530',       'Administrative — Safeguards',          'A covered entity must reasonably safeguard PHI from any intentional or unintentional use or disclosure that is in violation of the Privacy Rule.', 'admin', 'required', 1.0, hipaa_url, 'regulation'),
  (hipaa_id, '164.530(d)',            '164.530',       'Complaints',                           'A covered entity must provide a process for individuals to make complaints concerning its privacy policies and procedures.', 'admin', 'required', 0.5, hipaa_url, 'regulation'),
  (hipaa_id, '164.530(e)',            '164.530',       'Sanctions',                            'A covered entity must have and apply appropriate sanctions against members of its workforce who fail to comply with the privacy policies and procedures.', 'admin', 'required', 1.0, hipaa_url, 'regulation')
on conflict (framework_id, citation) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- SOC 2 — Trust Services Criteria depth across all five categories
-- ════════════════════════════════════════════════════════════════════
insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight, source_url, source_type) values
  -- Common Criteria — additional CC.x not yet seeded
  (soc2_id, 'CC1.2', 'CC1', 'Board Independence and Oversight',      'The board demonstrates independence from management and exercises oversight of internal control.', 'control_environment', 'required', 0.5, soc2_url, 'standard'),
  (soc2_id, 'CC1.3', 'CC1', 'Organizational Structure',              'Management establishes structures, reporting lines, and appropriate authorities/responsibilities.', 'control_environment', 'required', 0.5, soc2_url, 'standard'),
  (soc2_id, 'CC1.4', 'CC1', 'Workforce Competence',                  'Demonstrate a commitment to attract, develop, and retain competent individuals in alignment with objectives.', 'control_environment', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC1.5', 'CC1', 'Accountability',                        'Hold individuals accountable for their internal control responsibilities.', 'control_environment', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC2.2', 'CC2', 'Internal Communication',                'Internal communication of information to support the functioning of internal control.', 'communication', 'required', 0.5, soc2_url, 'standard'),
  (soc2_id, 'CC2.3', 'CC2', 'External Communication',                'Communication with external parties regarding matters affecting the functioning of internal control.', 'communication', 'required', 0.5, soc2_url, 'standard'),
  (soc2_id, 'CC3.1', 'CC3', 'Risk Identification',                   'Specify objectives with sufficient clarity to enable the identification and assessment of risks.', 'risk', 'required', 1.5, soc2_url, 'standard'),
  (soc2_id, 'CC3.2', 'CC3', 'Risk Analysis',                         'Identify risks to the achievement of objectives and analyze risks as a basis for determining how to manage them.', 'risk', 'required', 1.5, soc2_url, 'standard'),
  (soc2_id, 'CC3.3', 'CC3', 'Fraud Risk Assessment',                 'Consider the potential for fraud in assessing risks to the achievement of objectives.', 'risk', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC3.4', 'CC3', 'Change Risk Assessment',                'Identify and assess changes that could significantly impact the system of internal control.', 'risk', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC4.1', 'CC4', 'Ongoing Monitoring',                    'Select, develop, and perform ongoing and/or separate evaluations to determine whether internal control components are present and functioning.', 'monitoring', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC4.2', 'CC4', 'Deficiency Communication',              'Evaluate and communicate internal control deficiencies to those responsible for taking corrective action.', 'monitoring', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC5.3', 'CC5', 'Deployment Through Policies & Procedures', 'Deploy control activities through policies that establish what is expected and procedures that put policies into action.', 'control_activities', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC6.2', 'CC6', 'New User Provisioning',                 'New internal and external users are registered and authorized prior to issuing system credentials and granting the ability to access the system.', 'logical_access', 'required', 1.5, soc2_url, 'standard'),
  (soc2_id, 'CC6.3', 'CC6', 'Role-Based Access',                     'Authorize, modify, or remove access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design.', 'logical_access', 'required', 1.5, soc2_url, 'standard'),
  (soc2_id, 'CC6.4', 'CC6', 'Restricted Physical Access',            'Restrict physical access to facilities and protected information assets to authorized personnel.', 'logical_access', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'CC6.5', 'CC6', 'Logical Removal of Data',               'Discontinue logical and physical protections over physical assets only after the ability to read or recover data has been diminished.', 'logical_access', 'required', 1.5, soc2_url, 'standard'),
  -- Availability
  (soc2_id, 'A1.1',  'A1',  'Capacity Planning',                     'Maintain, monitor, and evaluate current processing capacity and use of system components to manage capacity demand.', 'availability', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'A1.2',  'A1',  'Environmental Protections + Backups',   'Authorize, design, develop, implement, operate, approve, maintain, and monitor environmental protections, software, data backup processes, and recovery infrastructure to meet objectives.', 'availability', 'required', 2.0, soc2_url, 'standard'),
  (soc2_id, 'A1.3',  'A1',  'Recovery Plan Testing',                 'Test recovery plan procedures to support system recovery in accordance with availability commitments and requirements.', 'availability', 'required', 1.5, soc2_url, 'standard'),
  -- Confidentiality
  (soc2_id, 'C1.1',  'C1',  'Identification + Protection of Confidential Info', 'Identify and maintain confidential information to meet the entity''s objectives related to confidentiality.', 'confidentiality', 'required', 1.5, soc2_url, 'standard'),
  (soc2_id, 'C1.2',  'C1',  'Disposal of Confidential Info',         'Dispose of confidential information to meet the entity''s objectives related to confidentiality.', 'confidentiality', 'required', 1.5, soc2_url, 'standard'),
  -- Processing Integrity
  (soc2_id, 'PI1.1', 'PI1', 'Quality of Inputs',                     'Obtain or generate, use, and communicate relevant, quality information regarding the objectives related to processing, including definitions of data processed and product and service specifications.', 'processing_integrity', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'PI1.2', 'PI1', 'System Inputs Complete + Accurate',     'Implement policies and procedures over system inputs, including controls over completeness and accuracy.', 'processing_integrity', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'PI1.3', 'PI1', 'Processing Complete + Accurate',        'Implement policies and procedures over system processing to result in products, services, and reporting that meet the entity''s objectives.', 'processing_integrity', 'required', 1.0, soc2_url, 'standard'),
  -- Privacy
  (soc2_id, 'P1.1',  'P1',  'Privacy Notice',                        'Provide notice to data subjects about its privacy practices to meet the entity''s objectives related to privacy.', 'privacy', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'P2.1',  'P2',  'Choice and Consent',                    'Communicate choices available regarding the collection, use, retention, disclosure, and disposal of personal information and obtain consent.', 'privacy', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'P3.1',  'P3',  'Collection — Personal Information',     'Collect personal information consistent with the entity''s objectives related to privacy.', 'privacy', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'P4.1',  'P4',  'Use, Retention, and Disposal',          'Limit the use of personal information to the purposes identified in the entity''s objectives.', 'privacy', 'required', 1.0, soc2_url, 'standard'),
  (soc2_id, 'P6.1',  'P6',  'Disclosure to Third Parties',           'Disclose personal information to third parties only for the purposes for which consent has been obtained and that meet the entity''s objectives related to privacy.', 'privacy', 'required', 1.0, soc2_url, 'standard')
on conflict (framework_id, citation) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- ISO 27001:2022 Annex A — all four categories, high-impact controls
-- ════════════════════════════════════════════════════════════════════
insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight, source_url, source_type) values
  -- Organizational A.5.x
  (iso_id, 'A.5.2',  'A.5', 'Information security roles and responsibilities', 'Information security roles and responsibilities shall be defined and allocated according to the organization needs.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.3',  'A.5', 'Segregation of duties',                            'Conflicting duties and conflicting areas of responsibility shall be segregated.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.4',  'A.5', 'Management responsibilities',                      'Management shall require all personnel to apply information security in accordance with the established policies, topic-specific policies, and procedures.', 'organizational', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.5.5',  'A.5', 'Contact with authorities',                         'Establish and maintain contact with relevant authorities.', 'organizational', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.5.7',  'A.5', 'Threat intelligence',                              'Information relating to information security threats shall be collected and analyzed to produce threat intelligence.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.8',  'A.5', 'Information security in project management',       'Address information security in project management.', 'organizational', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.5.9',  'A.5', 'Inventory of information and other associated assets', 'Develop and maintain an inventory of information and other associated assets, including owners.', 'organizational', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.5.11', 'A.5', 'Return of assets',                                 'Personnel shall return all of the organization''s assets in their possession upon change or termination of their employment, contract or agreement.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.12', 'A.5', 'Classification of information',                    'Classify information according to the information security needs of the organization based on confidentiality, integrity, availability and relevant requirements.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.13', 'A.5', 'Labelling of information',                         'Develop and implement an appropriate set of procedures for information labelling.', 'organizational', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.5.14', 'A.5', 'Information transfer',                             'Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities within the organization and between the organization and other parties.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.18', 'A.5', 'Access rights',                                    'Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the organization''s topic-specific policy on access control.', 'organizational', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.5.20', 'A.5', 'Addressing information security within supplier agreements', 'Establish and agree information security requirements with each supplier.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.21', 'A.5', 'Managing information security in the ICT supply chain', 'Define and implement processes and procedures to manage information security risks associated with the ICT products and services supply chain.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.25', 'A.5', 'Assessment and decision on information security events', 'Assess information security events and decide if they are to be categorized as information security incidents.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.26', 'A.5', 'Response to information security incidents',       'Respond to information security incidents in accordance with the documented procedures.', 'organizational', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.5.27', 'A.5', 'Learning from information security incidents',     'Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.28', 'A.5', 'Collection of evidence',                           'Establish procedures for the identification, collection, acquisition and preservation of information, which can serve as evidence.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.29', 'A.5', 'Information security during disruption',           'Plan how to maintain information security at an appropriate level during disruption.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.31', 'A.5', 'Legal, statutory, regulatory and contractual requirements', 'Identify, document, and keep up to date legal, statutory, regulatory and contractual requirements relevant to information security and the organization''s approach to meeting them.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.32', 'A.5', 'Intellectual property rights',                     'Implement appropriate procedures to protect intellectual property rights.', 'organizational', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.5.33', 'A.5', 'Protection of records',                            'Protect records from loss, destruction, falsification, unauthorized access and unauthorized release.', 'organizational', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.5.34', 'A.5', 'Privacy and protection of PII',                    'Identify and meet the requirements regarding the preservation of privacy and protection of personally identifiable information (PII) according to applicable laws and regulations.', 'organizational', 'required', 1.5, iso_url, 'standard'),
  -- People A.6.x
  (iso_id, 'A.6.1',  'A.6', 'Screening',                                        'Carry out background verification checks on all candidates to become personnel prior to joining the organization, in accordance with applicable laws, regulations and ethics.', 'people', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.6.2',  'A.6', 'Terms and conditions of employment',               'The employment contractual agreements shall state the personnel''s and the organization''s responsibilities for information security.', 'people', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.6.4',  'A.6', 'Disciplinary process',                             'Formalize and communicate a disciplinary process to take actions against personnel and other relevant interested parties who have committed an information security policy violation.', 'people', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.6.6',  'A.6', 'Confidentiality or non-disclosure agreements',     'Identify, regularly review, document, and have personnel and other relevant interested parties sign confidentiality or non-disclosure agreements reflecting the organization''s needs for the protection of information.', 'people', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.6.7',  'A.6', 'Remote working',                                   'Implement security measures when personnel are working remotely to protect information accessed, processed or stored outside the organization''s premises.', 'people', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.6.8',  'A.6', 'Information security event reporting',             'The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.', 'people', 'required', 1.0, iso_url, 'standard'),
  -- Physical A.7.x
  (iso_id, 'A.7.1',  'A.7', 'Physical security perimeters',                     'Security perimeters shall be defined and used to protect areas that contain information and other associated assets.', 'physical', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.7.2',  'A.7', 'Physical entry',                                   'Secure areas shall be protected by appropriate entry controls and access points.', 'physical', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.7.3',  'A.7', 'Securing offices, rooms and facilities',           'Design and implement physical security for offices, rooms and facilities.', 'physical', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.7.7',  'A.7', 'Clear desk and clear screen',                      'Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced.', 'physical', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.7.8',  'A.7', 'Equipment siting and protection',                  'Site equipment securely and protect it.', 'physical', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.7.10', 'A.7', 'Storage media',                                    'Manage storage media through their lifecycle of acquisition, use, transportation and disposal in accordance with the organization''s classification scheme and handling requirements.', 'physical', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.7.14', 'A.7', 'Secure disposal or re-use of equipment',           'Verify items of equipment containing storage media to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use.', 'physical', 'required', 1.5, iso_url, 'standard'),
  -- Technological A.8.x
  (iso_id, 'A.8.1',  'A.8', 'User end point devices',                           'Information stored on, processed by or accessible via user end point devices shall be protected.', 'technological', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.8.3',  'A.8', 'Information access restriction',                   'Restrict access to information and other associated assets in accordance with the established topic-specific policy on access control.', 'technological', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.8.4',  'A.8', 'Access to source code',                            'Manage read and write access to source code, development tools and software libraries.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.6',  'A.8', 'Capacity management',                              'The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.8',  'A.8', 'Management of technical vulnerabilities',          'Obtain information about technical vulnerabilities of information systems in use, evaluate the organization''s exposure to such vulnerabilities, and take appropriate measures.', 'technological', 'required', 1.5, iso_url, 'standard'),
  (iso_id, 'A.8.9',  'A.8', 'Configuration management',                         'Establish, document, implement, monitor and review configurations, including security configurations, of hardware, software, services and networks.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.11', 'A.8', 'Data masking',                                     'Data masking shall be used in accordance with the organization''s topic-specific policy on access control, business requirements, and applicable legislation.', 'technological', 'recommended', 0.5, iso_url, 'standard'),
  (iso_id, 'A.8.12', 'A.8', 'Data leakage prevention',                          'Apply data leakage prevention measures to systems, networks and any other devices that process, store or transmit sensitive information.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.14', 'A.8', 'Redundancy of information processing facilities',  'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.17', 'A.8', 'Clock synchronization',                            'The clocks of information processing systems shall be synchronized to approved time sources.', 'technological', 'required', 0.5, iso_url, 'standard'),
  (iso_id, 'A.8.18', 'A.8', 'Use of privileged utility programs',               'The use of utility programs that might be capable of overriding system and application controls shall be restricted and tightly controlled.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.21', 'A.8', 'Security of network services',                     'Security mechanisms, service levels, and service requirements of network services shall be identified, implemented and monitored.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.22', 'A.8', 'Segregation of networks',                          'Groups of information services, users and information systems shall be segregated in the organization''s networks.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.23', 'A.8', 'Web filtering',                                    'Access to external websites shall be managed to reduce exposure to malicious content.', 'technological', 'recommended', 0.5, iso_url, 'standard'),
  (iso_id, 'A.8.25', 'A.8', 'Secure development life cycle',                    'Rules for the secure development of software and systems shall be established and applied.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.28', 'A.8', 'Secure coding',                                    'Apply secure coding principles to software development.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.30', 'A.8', 'Outsourced development',                           'Direct, monitor and review activities related to outsourced system development.', 'technological', 'required', 1.0, iso_url, 'standard'),
  (iso_id, 'A.8.34', 'A.8', 'Protection of information systems during audit testing', 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.', 'technological', 'recommended', 0.5, iso_url, 'standard')
on conflict (framework_id, citation) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- GDPR — beyond Art. 32 / breach / records / by-design / integrity
-- ════════════════════════════════════════════════════════════════════
insert into framework_requirements (framework_id, citation, parent_citation, title, description, category, obligation_type, weight, source_url, source_type) values
  (gdpr_id, 'Art. 5(1)(a)',  'Art. 5',  'Lawfulness, fairness and transparency', 'Personal data shall be processed lawfully, fairly and in a transparent manner in relation to the data subject.', 'principles', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 5(1)(b)',  'Art. 5',  'Purpose limitation',                    'Personal data shall be collected for specified, explicit and legitimate purposes and not further processed in a manner that is incompatible with those purposes.', 'principles', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 5(1)(c)',  'Art. 5',  'Data minimisation',                     'Personal data shall be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed.', 'principles', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 5(1)(d)',  'Art. 5',  'Accuracy',                              'Personal data shall be accurate and, where necessary, kept up to date.', 'principles', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 5(1)(e)',  'Art. 5',  'Storage limitation',                    'Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed.', 'principles', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 6',        'Art. 6',  'Lawfulness of processing',              'Processing shall be lawful only if and to the extent that at least one of the listed conditions applies (consent, contract, legal obligation, vital interests, public task, legitimate interests).', 'lawful_basis', 'required', 1.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 7',        'Art. 7',  'Conditions for consent',                'Where processing is based on consent, the controller shall be able to demonstrate that the data subject has consented to processing.', 'lawful_basis', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 12',       'Art. 12', 'Transparent information, communication and modalities', 'The controller shall take appropriate measures to provide any information referred to in Articles 13 and 14 and any communication relating to processing in a concise, transparent, intelligible and easily accessible form.', 'rights', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 13',       'Art. 13', 'Information to be provided where data are collected from the data subject', 'Where personal data are collected from the data subject, the controller shall provide the data subject with prescribed information at the time when personal data are obtained.', 'rights', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 15',       'Art. 15', 'Right of access by the data subject',   'The data subject shall have the right to obtain confirmation as to whether or not personal data concerning them are being processed.', 'rights', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 16',       'Art. 16', 'Right to rectification',                'The data subject shall have the right to obtain rectification of inaccurate personal data concerning them.', 'rights', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 17',       'Art. 17', 'Right to erasure (right to be forgotten)', 'The data subject shall have the right to obtain the erasure of personal data concerning them without undue delay.', 'rights', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 18',       'Art. 18', 'Right to restriction of processing',    'The data subject shall have the right to obtain restriction of processing.', 'rights', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 20',       'Art. 20', 'Right to data portability',             'The data subject shall have the right to receive the personal data concerning them in a structured, commonly used and machine-readable format.', 'rights', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 21',       'Art. 21', 'Right to object',                       'The data subject shall have the right to object to processing of personal data concerning them.', 'rights', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 28',       'Art. 28', 'Processor (Data Processing Agreement)', 'Where processing is to be carried out on behalf of a controller, the controller shall use only processors providing sufficient guarantees and have a DPA in place.', 'governance', 'required', 1.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 35',       'Art. 35', 'Data protection impact assessment',     'Where a type of processing is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall carry out an assessment of the impact of the envisaged processing operations on the protection of personal data.', 'governance', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 37',       'Art. 37', 'Designation of the data protection officer', 'The controller and the processor shall designate a data protection officer in any case where required by law or by the nature of processing.', 'governance', 'required', 0.5, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 44',       'Art. 44', 'General principle for transfers',       'Any transfer of personal data to a third country or to an international organisation shall take place only if the conditions laid down in this Chapter are complied with.', 'transfers', 'required', 1.0, gdpr_url, 'regulation'),
  (gdpr_id, 'Art. 46',       'Art. 46', 'Transfers subject to appropriate safeguards', 'In the absence of an adequacy decision, a controller or processor may transfer personal data to a third country only if appropriate safeguards are provided.', 'transfers', 'required', 1.0, gdpr_url, 'regulation')
on conflict (framework_id, citation) do nothing;

-- ─── Provenance stamp on the new rows
update framework_requirements
set last_reviewed_at = now(),
    reviewed_by = 'Fortify content team — v2 deep expansion',
    is_official_language = true
where last_reviewed_at is null;

end $$;
