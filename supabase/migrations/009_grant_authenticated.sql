-- 009_grant_authenticated.sql
-- Bug fix: prior migrations enabled RLS and wrote policies but only
-- granted table privileges to service_role. PostgreSQL requires BOTH the
-- table GRANT and the matching RLS policy to allow an operation, so
-- authenticated users hit "permission denied for table X" before any policy
-- ran. This grants standard CRUD privileges on every tenant table that
-- actually exists in the current schema.

grant usage on schema public to authenticated, anon;

-- Iterate over every known tenant/reference table and grant if present.
do $$
declare
  t text;
  rw text[] := array[
    -- 002: compliance core
    'practices','practice_users','frameworks','framework_requirements',
    'controls','framework_mappings','evidence_checks','practice_evidence',
    'practice_controls','remediation_guidance','remediation_tasks',
    'evidence_snapshots','drift_alerts','audit_logs',
    -- 003: vendors
    'vendors','baas',
    -- 004: risk / policies / training / reports
    'risk_assessments','policies','policy_acknowledgments',
    'training_modules','training_completions','reports',
    -- 005: integrations
    'integrations',
    -- 007: onboarding v2
    'practice_locations','onboarding_integration_choices','assistance_requests',
    -- 008: profiles
    'user_profiles'
  ];
begin
  foreach t in array rw loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- Sequences for any serial/identity columns
grant usage, select on all sequences in schema public to authenticated;

-- Make every future table in public schema inherit these grants automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
