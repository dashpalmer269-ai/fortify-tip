-- 045_security_hardening_and_evaluator_fix.sql
--
-- A correctness + security pass driven by an external review.
--
--   A. CRITICAL evaluator fix. evaluate_satisfaction_rule_v2 (043) and its
--      v1 predecessor referenced columns that DO NOT EXIST on
--      practice_evidence: `source`, `evidence_type`, and
--      `collected_by_user_id`. The real columns are `collected_by` (no
--      `source`/`evidence_type`). As written, the evaluator throws
--      "column does not exist" whenever a check has a satisfaction_rule,
--      which made recompute_practice_control_status() silently error on
--      every call (callers don't inspect the RPC error). The satisfaction
--      engine therefore never actually drove control status against real
--      data. This migration rewrites the evaluator to derive the evidence
--      "source" from the joined evidence_checks.collection_method and the
--      "evidence_type" from evidence_checks.check_key — both real columns —
--      so it runs correctly.
--
--   B. Real reviewer approval (replaces the count shortcut). The 043
--      reviewer_approval_required path counted distinct submitters (>= 2),
--      which only meant "two people uploaded", not "someone reviewed".
--      This adds explicit review fields to practice_evidence
--      (reviewed_by, reviewed_at, review_status, review_reason) and
--      requires a real 'approved' review by a DIFFERENT user than the
--      collector.
--
--   C. Policy-acknowledgment authorization fix. acknowledge_policy(uuid,
--      uuid) trusted a caller-supplied p_user_id — any authenticated user
--      could acknowledge a policy on behalf of another. Replaced with
--      acknowledge_policy(uuid) that derives the user from auth.uid()
--      inside the function. Caller-supplied identity is gone.
--
--   D. SECURITY DEFINER hardening. Every SECURITY DEFINER function now
--      pins `SET search_path = public, pg_temp` to prevent search-path
--      injection. Covers acknowledge_policy, redeem_invite_code, and the
--      006 membership helpers (re-asserted). The satisfaction evaluators
--      are not DEFINER (they run as the caller) but also get a fixed
--      search_path for determinism.

-- ── B. Review fields on practice_evidence ─────────────────────────────────
alter table practice_evidence
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_status text
    check (review_status in ('pending','approved','rejected')),
  add column if not exists review_reason text;

create index if not exists idx_practice_evidence_review
  on practice_evidence(evidence_check_id, review_status)
  where review_status is not null;

-- ── A+B. Rewritten entry matcher — uses real columns only ─────────────────
-- An evidence_check has ONE collection_method, which fixes the "source"
-- category of all its evidence. Map:
--   automated_api     -> integration
--   document_upload   -> document_upload
--   manual_attestation-> attestation
-- evidence_type (rule entry) filters by evidence_checks.check_key.
create or replace function _rule_entry_satisfied(
  p_practice_id uuid,
  p_evidence_check_id uuid,
  p_entry jsonb,
  p_source_winner text
) returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_source text;
  v_status text;
  v_age_days int;
  v_evidence_type text;
  v_check_method text;
  v_check_key text;
  v_check_source text;
begin
  v_source := p_entry->>'source';
  v_status := p_entry->>'status';
  v_age_days := nullif(p_entry->>'age_days_lte', '')::int;
  v_evidence_type := p_entry->>'evidence_type';

  select collection_method, check_key into v_check_method, v_check_key
    from evidence_checks where id = p_evidence_check_id;

  v_check_source := case v_check_method
    when 'automated_api' then 'integration'
    when 'document_upload' then 'document_upload'
    when 'manual_attestation' then 'attestation'
    else null
  end;

  -- The rule entry's expected source must match this check's source category.
  if v_source is not null and v_source <> coalesce(v_check_source, '') then
    return false;
  end if;

  -- Source-priority gate: if a winner was chosen, only that source counts.
  if p_source_winner is not null
     and v_check_source is not null
     and v_check_source <> p_source_winner then
    return false;
  end if;

  -- evidence_type filters by the check's key.
  if v_evidence_type is not null and v_evidence_type <> coalesce(v_check_key, '') then
    return false;
  end if;

  return exists (
    select 1 from practice_evidence pe
    where pe.practice_id = p_practice_id
      and pe.evidence_check_id = p_evidence_check_id
      and pe.is_current = true
      and (v_status is null or pe.status = v_status)
      and (v_age_days is null
           or pe.collected_at > now() - make_interval(days => v_age_days))
  );
end;
$$;

-- ── A+B. Rewritten evaluator ──────────────────────────────────────────────
create or replace function evaluate_satisfaction_rule_v2(
  p_practice_id uuid,
  p_evidence_check_id uuid
) returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_rule jsonb;
  v_entry jsonb;
  v_match boolean := false;
  v_all_match boolean := true;
  v_required_integration text;
  v_integration_status text;
  v_source_priority jsonb;
  v_source_winner text;
  v_reviewer_required boolean := false;
  v_review_ok boolean;
  v_check_method text;
  v_check_source text;
begin
  -- Control exception (admin override) short-circuits the rule.
  if exists (
    select 1 from control_exceptions ce
    join evidence_checks ec on ec.control_id = ce.control_id
    where ec.id = p_evidence_check_id
      and ce.practice_id = p_practice_id
      and ce.revoked_at is null
      and (ce.expires_at is null or ce.expires_at > now())
  ) then
    return true;
  end if;

  select satisfaction_rule, collection_method into v_rule, v_check_method
    from evidence_checks where id = p_evidence_check_id;
  if v_rule is null then return false; end if;

  v_check_source := case v_check_method
    when 'automated_api' then 'integration'
    when 'document_upload' then 'document_upload'
    when 'manual_attestation' then 'attestation'
    else null
  end;

  -- Integration-disconnected hard fail.
  v_required_integration := v_rule->>'integration_disconnected_fail';
  if v_required_integration is not null then
    select status into v_integration_status
      from integrations
      where practice_id = p_practice_id
        and integration_type = v_required_integration
      order by last_synced_at desc nulls last
      limit 1;
    if v_integration_status is null or v_integration_status = 'disconnected' then
      return false;
    end if;
  end if;

  -- Reviewer-approval: require a REAL approval by a different user than the
  -- collector (replaces the prior distinct-submitter count shortcut).
  v_reviewer_required := coalesce((v_rule->>'reviewer_approval_required')::boolean, false);
  if v_reviewer_required then
    select exists (
      select 1 from practice_evidence pe
      where pe.practice_id = p_practice_id
        and pe.evidence_check_id = p_evidence_check_id
        and pe.is_current = true
        and pe.review_status = 'approved'
        and pe.reviewed_by is not null
        and (pe.collected_by is null or pe.reviewed_by <> pe.collected_by)
    ) into v_review_ok;
    if not v_review_ok then return false; end if;
  end if;

  -- Source priority: this check's own source category must be present in
  -- the priority list AND have current evidence; it becomes the winner.
  v_source_priority := v_rule->'source_priority';
  if v_source_priority is not null and jsonb_array_length(v_source_priority) > 0 then
    if v_check_source is null then return false; end if;
    if not (v_source_priority ? v_check_source) then return false; end if;
    if not exists (
      select 1 from practice_evidence
      where practice_id = p_practice_id
        and evidence_check_id = p_evidence_check_id
        and is_current = true
    ) then
      return false;
    end if;
    v_source_winner := v_check_source;
  end if;

  -- all_of: every entry must pass.
  if v_rule ? 'all_of' then
    v_all_match := true;
    for v_entry in select * from jsonb_array_elements(v_rule->'all_of') loop
      if not _rule_entry_satisfied(p_practice_id, p_evidence_check_id, v_entry, v_source_winner) then
        v_all_match := false;
        exit;
      end if;
    end loop;
    if not v_all_match then return false; end if;
  end if;

  -- any_of: at least one entry must pass.
  if v_rule ? 'any_of' then
    v_match := false;
    for v_entry in select * from jsonb_array_elements(v_rule->'any_of') loop
      if _rule_entry_satisfied(p_practice_id, p_evidence_check_id, v_entry, v_source_winner) then
        v_match := true;
        exit;
      end if;
    end loop;
    if not v_match then return false; end if;
  end if;

  return v_rule ? 'all_of' or v_rule ? 'any_of';
end;
$$;

-- Keep the v1 name delegating to v2, with a fixed search_path.
create or replace function evaluate_satisfaction_rule(
  p_practice_id uuid,
  p_evidence_check_id uuid
) returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select evaluate_satisfaction_rule_v2(p_practice_id, p_evidence_check_id);
$$;

-- recompute is not DEFINER, but pin search_path for determinism.
create or replace function recompute_practice_control_status(p_practice_id uuid)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
  v_pc record;
  v_total int;
  v_passing int;
  v_new_status text;
begin
  for v_pc in
    select pc.id as practice_control_id, pc.control_id, pc.status as current_status
    from practice_controls pc
    where pc.practice_id = p_practice_id
      and pc.status in ('not_started', 'compliant', 'partial', 'non_compliant')
  loop
    select count(*) into v_total
      from evidence_checks ec
      where ec.control_id = v_pc.control_id and ec.satisfaction_rule is not null;
    if v_total = 0 then continue; end if;

    select count(*) into v_passing
      from evidence_checks ec
      where ec.control_id = v_pc.control_id
        and ec.satisfaction_rule is not null
        and evaluate_satisfaction_rule(p_practice_id, ec.id);

    if v_passing = v_total then
      v_new_status := 'compliant';
    elsif v_passing > 0 then
      v_new_status := 'partial';
    elsif v_pc.current_status = 'not_started' then
      continue;
    else
      v_new_status := 'non_compliant';
    end if;

    if v_new_status <> v_pc.current_status then
      update practice_controls
        set status = v_new_status, last_status_change_at = now()
        where id = v_pc.practice_control_id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ── C+D. acknowledge_policy: identity from auth.uid(), hardened ───────────
-- Drop the old (uuid, uuid) signature and replace with (uuid) so a
-- caller-supplied user id is impossible.
drop function if exists acknowledge_policy(uuid, uuid);

create or replace function acknowledge_policy(
  p_policy_id uuid,
  out acknowledgment_id uuid,
  out resolved_task_id uuid,
  out already_acknowledged boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_policy_practice uuid;
  v_policy_version int;
  v_policy_status text;
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select practice_id, version, status into v_policy_practice, v_policy_version, v_policy_status
    from policies where id = p_policy_id for update;

  if v_policy_practice is null then
    raise exception 'Policy not found' using errcode = 'P0001';
  end if;
  if v_policy_status <> 'active' then
    raise exception 'Only active policies can be acknowledged' using errcode = 'P0001';
  end if;

  -- The acknowledging user must be a member of the policy's practice.
  if not exists (
    select 1 from practice_users
    where practice_id = v_policy_practice and user_id = v_user
  ) then
    raise exception 'No membership in policy practice' using errcode = '28000';
  end if;

  select id into v_existing
    from policy_acknowledgments
    where policy_id = p_policy_id and user_id = v_user and policy_version = v_policy_version;

  if v_existing is not null then
    acknowledgment_id := v_existing;
    already_acknowledged := true;
  else
    insert into policy_acknowledgments (policy_id, practice_id, user_id, policy_version, acknowledged_at)
      values (p_policy_id, v_policy_practice, v_user, v_policy_version, now())
      returning id into acknowledgment_id;
    already_acknowledged := false;
  end if;

  update remediation_tasks
    set status = 'done', completed_at = now()
    where practice_id = v_policy_practice
      and source = 'policy_ack'
      and subject_ref = p_policy_id::text
      and assigned_to = v_user
      and status in ('open', 'in_progress', 'blocked')
    returning id into resolved_task_id;

  insert into audit_logs (practice_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (
      v_policy_practice, v_user, 'policy.acknowledged', 'policy', p_policy_id,
      jsonb_build_object(
        'policy_version', v_policy_version,
        'already_acknowledged', already_acknowledged,
        'resolved_task_id', resolved_task_id
      )
    );
end;
$$;

grant execute on function acknowledge_policy(uuid) to authenticated;

-- ── D. redeem_invite_code: pin search_path (already SECURITY DEFINER) ─────
-- Re-assert the full definition with the hardened search_path. Body is
-- unchanged from 042 except the SET clause.
create or replace function redeem_invite_code(
  p_user_id uuid,
  p_practice_id uuid,
  p_plaintext_code text,
  out access_expires_at timestamptz,
  out reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_row invite_codes%rowtype;
  v_expires timestamptz;
begin
  if p_plaintext_code is null or length(p_plaintext_code) < 8 then
    reason := 'invalid_format';
    return;
  end if;
  v_hash := encode(digest(p_plaintext_code, 'sha256'), 'hex');

  select * into v_row from invite_codes where code_hash = v_hash for update;

  if not found then reason := 'not_found'; return; end if;
  if v_row.revoked_at is not null then reason := 'revoked'; return; end if;
  if v_row.link_expires_at < now() then reason := 'expired'; return; end if;
  if v_row.used_count >= v_row.max_uses then reason := 'depleted'; return; end if;

  v_expires := now() + make_interval(mins => v_row.access_duration_minutes);

  insert into invite_redemptions (code_id, user_id, practice_id, access_expires_at)
    values (v_row.id, p_user_id, p_practice_id, v_expires);
  update invite_codes set used_count = used_count + 1 where id = v_row.id;
  update practices set plan_source = 'invite', access_expires_at = v_expires
    where id = p_practice_id;

  access_expires_at := v_expires;
  reason := 'ok';
end;
$$;

grant execute on function redeem_invite_code(uuid, uuid, text) to authenticated;

-- ── D. 006 membership helpers: add pg_temp to the search_path ─────────────
create or replace function public.user_is_practice_member(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.practice_users
    where practice_id = p_practice_id and user_id = auth.uid()
  );
$$;

create or replace function public.user_is_practice_admin(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.practice_users
    where practice_id = p_practice_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'compliance_officer')
  );
$$;
