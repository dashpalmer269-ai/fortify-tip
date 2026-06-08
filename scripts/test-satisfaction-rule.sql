-- test-satisfaction-rule.sql
--
-- Self-check script for the evaluate_satisfaction_rule() and
-- recompute_practice_control_status() functions added in migration 042.
--
-- Run this in the Supabase SQL editor (or psql) AGAINST A NON-PROD DATABASE
-- or wrap it in BEGIN; ... ROLLBACK; — the script seeds test fixtures
-- and asserts behavior, but should not be left committed if you want a
-- clean DB.
--
-- Covers the seven test cases the user asked for:
--   1. fresh attestation passes
--   2. expired attestation fails
--   3. manual upload within age passes
--   4. old upload fails
--   5. integration pass works
--   6. integration fail does not satisfy
--   7. recompute changes compliant → non_compliant after evidence expires

begin;

-- ─── Setup: a test practice, control, evidence_check, mapping ──────────────
do $$
declare
  v_practice_id uuid := gen_random_uuid();
  v_control_id uuid;
  v_user_id uuid := gen_random_uuid();
  v_ec_attestation uuid := gen_random_uuid();
  v_ec_upload uuid := gen_random_uuid();
  v_ec_integration uuid := gen_random_uuid();
  v_result boolean;
  v_pc_id uuid;
begin
  -- Seed user (the SQL function references auth.users via FK on
  -- practice_users — we just need a user_id that exists)
  insert into auth.users (id, email, created_at) values (v_user_id, 'rule-test@example.com', now())
    on conflict (id) do nothing;

  -- Practice
  insert into practices (id, name, frameworks_enabled)
    values (v_practice_id, 'Rule Test Practice', array['HIPAA']);

  -- Control to attach evidence checks to
  insert into controls (control_key, title, framework_code, category, default_priority, status, healthcare_baseline)
    values ('test.rule', 'Test Rule', 'HIPAA', 'test', 'medium', 'active', false)
    returning id into v_control_id;

  -- Three evidence checks — one per rule source
  insert into evidence_checks (id, control_id, check_key, collection_method, satisfaction_rule, frequency_hours)
    values (
      v_ec_attestation, v_control_id, 'test.attestation',
      'manual_attestation',
      '{"any_of":[{"source":"attestation","age_days_lte":90}]}'::jsonb,
      24
    ),
    (
      v_ec_upload, v_control_id, 'test.upload',
      'document_upload',
      '{"any_of":[{"source":"document_upload","age_days_lte":365}]}'::jsonb,
      24
    ),
    (
      v_ec_integration, v_control_id, 'test.integration',
      'automated_api',
      '{"any_of":[{"source":"integration","status":"pass"}]}'::jsonb,
      24
    );

  -- Practice-control row in compliant state to test the recompute flip
  insert into practice_controls (practice_id, control_id, status)
    values (v_practice_id, v_control_id, 'compliant')
    returning id into v_pc_id;

  -- ─── Test 1: fresh attestation passes ────────────────────────────────────
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current)
    values (v_practice_id, v_ec_attestation, 'attestation', now() - interval '7 days', 'pass', true);

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_attestation);
  if v_result is not true then
    raise exception 'Test 1 FAILED: fresh attestation should pass (got %)', v_result;
  end if;
  raise notice 'Test 1 PASS: fresh attestation satisfies the rule';

  -- ─── Test 2: expired attestation fails ───────────────────────────────────
  update practice_evidence set collected_at = now() - interval '120 days'
    where practice_id = v_practice_id and evidence_check_id = v_ec_attestation;

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_attestation);
  if v_result is not false then
    raise exception 'Test 2 FAILED: expired attestation should NOT pass (got %)', v_result;
  end if;
  raise notice 'Test 2 PASS: expired attestation fails the rule';

  -- ─── Test 3: manual upload within age passes ─────────────────────────────
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current)
    values (v_practice_id, v_ec_upload, 'manual_upload', now() - interval '30 days', 'pass', true);

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_upload);
  if v_result is not true then
    raise exception 'Test 3 FAILED: 30-day-old upload should pass (got %)', v_result;
  end if;
  raise notice 'Test 3 PASS: upload within age window satisfies the rule';

  -- ─── Test 4: old upload fails ────────────────────────────────────────────
  update practice_evidence set collected_at = now() - interval '400 days'
    where practice_id = v_practice_id and evidence_check_id = v_ec_upload;

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_upload);
  if v_result is not false then
    raise exception 'Test 4 FAILED: 400-day-old upload should NOT pass (got %)', v_result;
  end if;
  raise notice 'Test 4 PASS: stale upload fails the rule';

  -- ─── Test 5: integration pass works ──────────────────────────────────────
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current)
    values (v_practice_id, v_ec_integration, 'integration_api', now(), 'pass', true);

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_integration);
  if v_result is not true then
    raise exception 'Test 5 FAILED: integration pass should satisfy (got %)', v_result;
  end if;
  raise notice 'Test 5 PASS: integration pass satisfies the rule';

  -- ─── Test 6: integration fail does not satisfy ───────────────────────────
  update practice_evidence set status = 'fail'
    where practice_id = v_practice_id and evidence_check_id = v_ec_integration;

  v_result := evaluate_satisfaction_rule(v_practice_id, v_ec_integration);
  if v_result is not false then
    raise exception 'Test 6 FAILED: integration fail should NOT satisfy (got %)', v_result;
  end if;
  raise notice 'Test 6 PASS: integration fail does not satisfy the rule';

  -- ─── Test 7: recompute changes compliant → non_compliant ─────────────────
  -- At this point: attestation expired, upload expired, integration failing.
  -- All three rules fail, so the control should flip from compliant →
  -- non_compliant.
  perform recompute_practice_control_status(v_practice_id);

  if (select status from practice_controls where id = v_pc_id) <> 'non_compliant' then
    raise exception 'Test 7 FAILED: control should be non_compliant after all evidence expired, got %',
      (select status from practice_controls where id = v_pc_id);
  end if;
  raise notice 'Test 7 PASS: recompute flipped compliant → non_compliant';

  raise notice '✓ All 7 satisfaction-rule tests passed';
end $$;

-- Always roll back the test fixtures so the DB stays clean.
rollback;
