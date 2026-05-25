-- 013_no_phi_invariant.sql
-- Hardcode the No-PHI invariant into the database. Two purposes:
--   1. COMMENT ON TABLE serves as documentation visible to any DBA tooling,
--      Supabase Studio, pg_dump, and anyone inspecting the schema.
--   2. CHECK constraints catch obvious PHI patterns at write time (SSN,
--      MRN) so that even if an API endpoint forgets to call scanFieldsForPhi,
--      the database refuses the insert.
--
-- The constraints are intentionally narrow: they catch the highest-signal
-- patterns (Social Security Numbers, "MRN: 1234567") without producing
-- noisy false positives on legitimate compliance text. The full-fidelity
-- check lives in lib/compliance/no-phi.ts at the API boundary.

-- ── COMMENT ON TABLE directives ─────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'practices','practice_users','practice_locations','user_profiles',
    'policies','policy_acknowledgments','risk_assessments','reports',
    'vendors','baas','audit_logs','notifications','remediation_tasks',
    'practice_evidence','onboarding_integration_choices','assistance_requests'
  ]) loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'comment on table public.%I is %L',
        t,
        'NO PHI. This table must never store Protected Health Information (45 CFR §160.103). Fortify is a compliance/cybersecurity SaaS for healthcare practices; it explicitly does not handle patient data. See lib/compliance/no-phi.ts.'
      );
    end if;
  end loop;
end $$;

-- ── CHECK constraint helper: rejects strings containing SSN or MRN patterns ─
create or replace function _no_phi_check(s text) returns boolean
language plpgsql immutable as $body$
begin
  if s is null then return true; end if;
  -- SSN: 123-45-6789, 123 45 6789, plain 9-digit
  if s ~ '\m\d{3}[- ]?\d{2}[- ]?\d{4}\m' then return false; end if;
  -- MRN explicit
  if s ~* '\m(MRN|MR#|medical[\s_-]record)[\s:#-]*\d{4,}' then return false; end if;
  return true;
end
$body$;

-- ── Apply the CHECK to the highest-risk free-text columns ───────────────────
-- (Names, descriptions, and content fields that admins or AI write into.)
do $$
declare
  cols jsonb := jsonb_build_array(
    jsonb_build_object('table','practices',                    'column','description'),
    jsonb_build_object('table','practices',                    'column','name'),
    jsonb_build_object('table','policies',                     'column','content_markdown'),
    jsonb_build_object('table','policies',                     'column','title'),
    jsonb_build_object('table','risk_assessments',             'column','executive_summary'),
    jsonb_build_object('table','risk_assessments',             'column','remediation_plan'),
    jsonb_build_object('table','reports',                      'column','executive_summary'),
    jsonb_build_object('table','user_profiles',                'column','full_name'),
    jsonb_build_object('table','user_profiles',                'column','pending_practice_name'),
    jsonb_build_object('table','user_profiles',                'column','claimed_admin_name'),
    jsonb_build_object('table','user_profiles',                'column','job_title'),
    jsonb_build_object('table','user_profiles',                'column','denial_reason'),
    jsonb_build_object('table','notifications',                'column','body'),
    jsonb_build_object('table','notifications',                'column','title'),
    jsonb_build_object('table','assistance_requests',          'column','notes')
  );
  c jsonb; t text; col text; constraint_name text;
begin
  for c in select * from jsonb_array_elements(cols) loop
    t := c->>'table';
    col := c->>'column';
    if to_regclass('public.' || t) is null then continue; end if;
    -- Skip if column doesn't exist (schema variation tolerance)
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = col
    ) then continue; end if;

    constraint_name := format('no_phi_%s_%s', t, col);
    -- Drop pre-existing version so this migration is rerunnable
    execute format('alter table public.%I drop constraint if exists %I', t, constraint_name);
    execute format(
      'alter table public.%I add constraint %I check (_no_phi_check(%I))',
      t, constraint_name, col
    );
  end loop;
end $$;

comment on function _no_phi_check(text) is
  'Returns false if the argument contains an obvious PHI pattern (SSN or MRN). Used in NO_PHI_* CHECK constraints. Defense-in-depth alongside lib/compliance/no-phi.ts at the API boundary.';
