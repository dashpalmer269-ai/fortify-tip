-- 020_seed_okta_evidence_checks.sql
-- Seeds Okta evidence_checks mapped to existing controls. 'okta' is already in
-- the integrations.integration_type allowed set (since migration 005).

do $$
declare
  ctrl_acc001 uuid := (select id from controls where control_key = 'ACC-001');  -- MFA admins
  ctrl_acc002 uuid := (select id from controls where control_key = 'ACC-002');  -- MFA workforce
  ctrl_log001 uuid := (select id from controls where control_key = 'LOG-001');  -- audit log
begin
  if ctrl_acc002 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_acc002,
      'okta_mfa_policy_active',
      'Okta: at least one active MFA enrollment policy',
      'Lists MFA_ENROLL policies and passes when at least one is ACTIVE.',
      'automated_api', 'okta', 24,
      '{"min_active_policies":1}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  if ctrl_acc001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_acc001,
      'okta_admins_mfa',
      'Okta: every admin has an active MFA factor',
      'Enumerates active users, identifies those with an active admin role, and verifies each has at least one active MFA factor enrolled.',
      'automated_api', 'okta', 24,
      '{"admins_missing_mfa":0}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  if ctrl_log001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_log001,
      'okta_system_log_accessible',
      'Okta: system log accessible and producing events',
      'Calls the System Log API with limit=1 as a liveness probe. Passes when at least one event is returned.',
      'automated_api', 'okta', 24,
      '{"min_recent_events":1}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;
end $$;
