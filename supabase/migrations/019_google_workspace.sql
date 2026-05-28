-- 019_google_workspace.sql
-- Adds 'google_workspace' to the integrations.integration_type allowed set and
-- seeds Google Workspace evidence_checks mapped to existing controls.

-- ── Widen the integration_type CHECK constraint ──────────────────────────
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'integrations'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%integration_type%';
  if conname is not null then
    execute format('alter table integrations drop constraint %I', conname);
  end if;
end $$;

alter table integrations
  add constraint integrations_integration_type_check
  check (integration_type in (
    'microsoft_365','google_workspace','aws','datto','connectwise','okta','azure_ad'
  ));

-- ── Google Workspace evidence checks ─────────────────────────────────────
do $$
declare
  ctrl_acc001 uuid := (select id from controls where control_key = 'ACC-001');  -- MFA admins
  ctrl_acc002 uuid := (select id from controls where control_key = 'ACC-002');  -- MFA workforce
  ctrl_log001 uuid := (select id from controls where control_key = 'LOG-001');  -- audit log
begin
  if ctrl_acc001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_acc001,
      'google_admin_2sv_enforced',
      'Google Workspace: 2-Step Verification enrolled for every admin',
      'Lists directory users with admin/delegated-admin flags and verifies each is enrolled in 2-Step Verification.',
      'automated_api', 'google_workspace', 24,
      '{"admins_missing_2sv":0}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  if ctrl_acc002 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_acc002,
      'google_all_2sv_enrolled',
      'Google Workspace: 2-Step Verification enrolled across all active users',
      'Pages through all active directory users and computes the percentage enrolled in 2-Step Verification. Passes at 100%.',
      'automated_api', 'google_workspace', 24,
      '{"min_pct":100}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;

  if ctrl_log001 is not null then
    insert into evidence_checks (control_id, check_key, title, description, collection_method, source_integration, frequency_hours, pass_criteria)
    values (
      ctrl_log001,
      'google_audit_log_accessible',
      'Google Workspace: admin audit log accessible and producing events',
      'Calls the Reports API admin activity endpoint as a liveness probe. Passes when at least one event is returned.',
      'automated_api', 'google_workspace', 24,
      '{"min_recent_events":1}'::jsonb
    ) on conflict (control_id, check_key) do nothing;
  end if;
end $$;
