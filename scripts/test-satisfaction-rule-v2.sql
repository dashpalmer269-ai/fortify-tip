-- test-satisfaction-rule-v2.sql
--
-- Self-check script for evaluate_satisfaction_rule_v2() (migration 043).
-- Covers the richer DSL: all_of, source_priority, evidence_type,
-- reviewer_approval_required, integration_disconnected_fail, and
-- control_exceptions (critical-finding override).
--
-- Run in Supabase SQL editor. Wraps in BEGIN ... ROLLBACK so no fixtures
-- persist.

begin;

do $$
declare
  v_practice_id uuid := gen_random_uuid();
  v_control_id uuid;
  v_user_1 uuid := gen_random_uuid();
  v_user_2 uuid := gen_random_uuid();
  v_ec_allof uuid := gen_random_uuid();
  v_ec_reviewer uuid := gen_random_uuid();
  v_ec_priority uuid := gen_random_uuid();
  v_ec_type uuid := gen_random_uuid();
  v_ec_disconnect uuid := gen_random_uuid();
  v_ec_exception uuid := gen_random_uuid();
  v_result boolean;
begin
  insert into auth.users (id, email, created_at) values
    (v_user_1, 'rule-v2-test-1@example.com', now()),
    (v_user_2, 'rule-v2-test-2@example.com', now())
    on conflict (id) do nothing;

  insert into practices (id, name, frameworks_enabled)
    values (v_practice_id, 'Rule v2 Test Practice', array['HIPAA']);

  insert into controls (control_key, title, framework_code, category, default_priority, status, healthcare_baseline)
    values ('test.rule.v2', 'Test Rule v2', 'HIPAA', 'test', 'medium', 'active', false)
    returning id into v_control_id;

  insert into evidence_checks (id, control_id, check_key, collection_method, satisfaction_rule, frequency_hours)
    values
      (v_ec_allof, v_control_id, 'test.allof', 'manual_attestation',
       '{"all_of":[{"source":"attestation","age_days_lte":90},{"source":"integration","status":"pass"}]}'::jsonb, 24),
      (v_ec_reviewer, v_control_id, 'test.reviewer', 'manual_attestation',
       '{"any_of":[{"source":"attestation","age_days_lte":365}],"reviewer_approval_required":true}'::jsonb, 24),
      (v_ec_priority, v_control_id, 'test.priority', 'automated_api',
       '{"any_of":[{"source":"integration","status":"pass"},{"source":"attestation","age_days_lte":365}],"source_priority":["integration","attestation"]}'::jsonb, 24),
      (v_ec_type, v_control_id, 'test.type', 'document_upload',
       '{"any_of":[{"source":"document_upload","age_days_lte":730,"evidence_type":"policy_signed_baa"}]}'::jsonb, 24),
      (v_ec_disconnect, v_control_id, 'test.disconnect', 'automated_api',
       '{"any_of":[{"source":"integration","status":"pass"}],"integration_disconnected_fail":"m365"}'::jsonb, 24),
      (v_ec_exception, v_control_id, 'test.exception', 'manual_attestation',
       '{"any_of":[{"source":"attestation","age_days_lte":1}]}'::jsonb, 24);

  insert into practice_controls (practice_id, control_id, status)
    values (v_practice_id, v_control_id, 'compliant');

  -- ── Test 1: all_of — both required, only one present → fails ──────────
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_allof, 'attestation', now(), 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_allof);
  if v_result is not false then
    raise exception 'Test 1 FAILED: all_of with only attestation should fail (got %)', v_result;
  end if;
  raise notice 'Test 1 PASS: all_of fails when one source is missing';

  -- Add the second source → now passes
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_allof, 'integration_api', now(), 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_allof);
  if v_result is not true then
    raise exception 'Test 1b FAILED: all_of with both sources should pass (got %)', v_result;
  end if;
  raise notice 'Test 1b PASS: all_of satisfied when both sources present';

  -- ── Test 2: reviewer_approval — single submitter fails ────────────────
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_reviewer, 'attestation', now(), 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_reviewer);
  if v_result is not false then
    raise exception 'Test 2 FAILED: single-submitter attestation should fail reviewer requirement (got %)', v_result;
  end if;
  raise notice 'Test 2 PASS: reviewer requirement blocks self-attestation';

  -- Second submitter satisfies
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_reviewer, 'attestation', now(), 'pass', true, v_user_2);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_reviewer);
  if v_result is not true then
    raise exception 'Test 2b FAILED: second submitter should satisfy reviewer requirement (got %)', v_result;
  end if;
  raise notice 'Test 2b PASS: reviewer requirement satisfied by second submitter';

  -- ── Test 3: source_priority — integration takes precedence ────────────
  -- Integration evidence is present + passing → it's the authoritative source
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values
      (v_practice_id, v_ec_priority, 'integration_api', now(), 'pass', true, v_user_1),
      (v_practice_id, v_ec_priority, 'attestation', now(), 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_priority);
  if v_result is not true then
    raise exception 'Test 3 FAILED: source_priority should pass when top source is pass (got %)', v_result;
  end if;
  raise notice 'Test 3 PASS: source_priority honors the highest-priority source';

  -- ── Test 4: evidence_type filter ──────────────────────────────────────
  -- Upload exists but wrong evidence_type → fails
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id, evidence_type)
    values (v_practice_id, v_ec_type, 'manual_upload', now(), 'pass', true, v_user_1, 'policy_baseline');
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_type);
  if v_result is not false then
    raise exception 'Test 4 FAILED: evidence_type mismatch should fail (got %)', v_result;
  end if;
  raise notice 'Test 4 PASS: evidence_type filter rejects wrong type';

  -- Add the right type → passes
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id, evidence_type)
    values (v_practice_id, v_ec_type, 'manual_upload', now() - interval '30 days', 'pass', true, v_user_1, 'policy_signed_baa');
  -- Mark the prior wrong-type row as not current
  update practice_evidence set is_current = false
    where evidence_check_id = v_ec_type and evidence_type = 'policy_baseline';
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_type);
  if v_result is not true then
    raise exception 'Test 4b FAILED: evidence_type match should pass (got %)', v_result;
  end if;
  raise notice 'Test 4b PASS: evidence_type filter accepts matching type';

  -- ── Test 5: integration_disconnected_fail ─────────────────────────────
  -- No integration row at all → disconnected → fail
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_disconnect, 'integration_api', now(), 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_disconnect);
  if v_result is not false then
    raise exception 'Test 5 FAILED: missing integration row should fail (got %)', v_result;
  end if;
  raise notice 'Test 5 PASS: disconnected integration triggers hard fail';

  -- Add a connected integration → passes
  insert into integrations (practice_id, integration_type, status, last_synced_at)
    values (v_practice_id, 'm365', 'connected', now());
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_disconnect);
  if v_result is not true then
    raise exception 'Test 5b FAILED: connected integration + pass evidence should pass (got %)', v_result;
  end if;
  raise notice 'Test 5b PASS: connected integration satisfies the rule';

  -- ── Test 6: control_exception (critical-finding override) ─────────────
  -- Evidence is stale (1-day window, written 2 days ago) → would fail
  insert into practice_evidence (practice_id, evidence_check_id, source, collected_at, status, is_current, collected_by_user_id)
    values (v_practice_id, v_ec_exception, 'attestation', now() - interval '2 days', 'pass', true, v_user_1);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_exception);
  if v_result is not false then
    raise exception 'Test 6 FAILED: stale attestation should fail without override (got %)', v_result;
  end if;
  raise notice 'Test 6 PASS: stale evidence fails without an override';

  -- Add a control exception → evaluates true even with stale evidence
  insert into control_exceptions (practice_id, control_id, granted_by, reason, is_critical_override)
    values (v_practice_id, v_control_id, v_user_1, 'temporary IT freeze; verified compensating control', true);
  v_result := evaluate_satisfaction_rule_v2(v_practice_id, v_ec_exception);
  if v_result is not true then
    raise exception 'Test 6b FAILED: active control_exception should satisfy rule (got %)', v_result;
  end if;
  raise notice 'Test 6b PASS: control_exception satisfies the rule as override';

  raise notice '✓ All 6 richer-rule tests passed';
end $$;

rollback;
