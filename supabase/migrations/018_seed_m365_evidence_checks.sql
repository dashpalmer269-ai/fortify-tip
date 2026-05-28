-- 018_seed_m365_evidence_checks.sql
-- Wires the M365 evidence collectors to existing controls. Each row tells the
-- verify-compliance cron "run check_key=X via source_integration=microsoft_365
-- every Y hours, and treat the result as evidence for this control."
--
-- These check_keys are dispatched in lib/compliance/runner.ts → runMicrosoft365Check.

do $$
declare
  ctrl_acc001 uuid := (select id from controls where control_key = 'ACC-001');  -- MFA admins
  ctrl_acc002 uuid := (select id from controls where control_key = 'ACC-002');  -- MFA workforce
  ctrl_log001 uuid := (select id from controls where control_key = 'LOG-001');  -- audit log
begin
  -- M365 MFA admins enforced → ACC-001 (critical)
  if ctrl_acc001 is not null then
    insert into evidence_checks (
      control_id, check_key, title, description,
      collection_method, source_integration, frequency_hours, pass_criteria
    ) values (
      ctrl_acc001,
      'm365_mfa_admins_enforced',
      'M365: MFA enforced for every privileged-role administrator',
      'Pulls every M365 directoryRole that maps to a known privileged template (Global Admin, Security Admin, etc.), enumerates members, and verifies each has at least one strong MFA factor registered (FIDO2, Authenticator, phone, software OATH, or Windows Hello for Business).',
      'automated_api',
      'microsoft_365',
      24,
      '{"admins_missing_mfa":0}'::jsonb
    ) on conflict (control_id, check_key) do nothing;

    insert into evidence_checks (
      control_id, check_key, title, description,
      collection_method, source_integration, frequency_hours, pass_criteria
    ) values (
      ctrl_acc001,
      'm365_conditional_access_mfa',
      'M365: at least one enabled Conditional Access policy enforces MFA',
      'Lists conditional access policies; passes when at least one enabled policy includes "mfa" in builtInControls.',
      'automated_api',
      'microsoft_365',
      24,
      '{"min_enabled_mfa_policies":1}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  -- M365 MFA workforce enforced → ACC-002 (high)
  if ctrl_acc002 is not null then
    insert into evidence_checks (
      control_id, check_key, title, description,
      collection_method, source_integration, frequency_hours, pass_criteria
    ) values (
      ctrl_acc002,
      'm365_mfa_users_enforced',
      'M365: MFA registered for every user account',
      'Calls /reports/credentialUserRegistrationDetails and computes the percentage of users with MFA registered. Passes only at 100%.',
      'automated_api',
      'microsoft_365',
      24,
      '{"min_pct":100}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  -- M365 audit log enabled → LOG-001 (critical)
  if ctrl_log001 is not null then
    insert into evidence_checks (
      control_id, check_key, title, description,
      collection_method, source_integration, frequency_hours, pass_criteria
    ) values (
      ctrl_log001,
      'm365_audit_log_enabled',
      'M365: unified audit log accessible and producing events',
      'Calls /auditLogs/directoryAudits with $top=1 as a liveness probe. Passes when at least one recent event is returned.',
      'automated_api',
      'microsoft_365',
      24,
      '{"min_recent_events":1}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;
end $$;
