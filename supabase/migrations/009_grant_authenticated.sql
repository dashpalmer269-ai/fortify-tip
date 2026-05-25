-- 009_grant_authenticated.sql
-- Bug fix: migrations 002-008 enabled RLS and wrote policies but only
-- granted table privileges to service_role. PostgreSQL requires BOTH the
-- table GRANT and the matching RLS policy to allow an operation, so
-- authenticated users hit "permission denied for table X" before any policy
-- ran. This grants the standard authenticated/anon privileges on every
-- tenant table so RLS policies can actually do their job.

grant usage on schema public to authenticated, anon;

-- Existing tables (002 + 003 + 004 + 005 + 007 + 008)
grant select, insert, update, delete on practices                       to authenticated;
grant select, insert, update, delete on practice_users                  to authenticated;
grant select                          on controls                       to authenticated;
grant select                          on framework_requirements         to authenticated;
grant select                          on framework_mappings             to authenticated;
grant select, insert, update, delete on practice_controls               to authenticated;
grant select, insert, update, delete on evidence                        to authenticated;
grant select, insert, update, delete on audit_logs                      to authenticated;

-- 003: vendors / BAAs
do $$ begin
  if to_regclass('public.vendors') is not null then
    execute 'grant select, insert, update, delete on vendors to authenticated';
  end if;
  if to_regclass('public.baas') is not null then
    execute 'grant select, insert, update, delete on baas to authenticated';
  end if;
end $$;

-- 004: risk / policies / reports
do $$ begin
  if to_regclass('public.risk_assessments') is not null then
    execute 'grant select, insert, update, delete on risk_assessments to authenticated';
  end if;
  if to_regclass('public.policies') is not null then
    execute 'grant select, insert, update, delete on policies to authenticated';
  end if;
  if to_regclass('public.policy_acknowledgments') is not null then
    execute 'grant select, insert, update, delete on policy_acknowledgments to authenticated';
  end if;
  if to_regclass('public.reports') is not null then
    execute 'grant select, insert, update, delete on reports to authenticated';
  end if;
end $$;

-- 005: integrations
do $$ begin
  if to_regclass('public.integrations') is not null then
    execute 'grant select, insert, update, delete on integrations to authenticated';
  end if;
end $$;

-- 007: onboarding v2 tables
grant select, insert, update, delete on practice_locations              to authenticated;
grant select, insert, update, delete on onboarding_integration_choices  to authenticated;
grant select, insert, update, delete on assistance_requests             to authenticated;

-- 008: user profiles
grant select, insert, update, delete on user_profiles                   to authenticated;

-- Sequences (for tables with serial PKs, if any)
grant usage, select on all sequences in schema public to authenticated;

-- Belt-and-suspenders: any tables added later default to having these grants
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
