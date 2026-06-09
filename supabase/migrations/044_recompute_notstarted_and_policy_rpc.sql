-- 044_recompute_notstarted_and_policy_rpc.sql
--
-- Two correctness improvements:
--
--   1. Fix recompute_practice_control_status — the prior implementation
--      skipped rows in status 'not_started'. If an integration began
--      producing valid evidence for a not-yet-started control (which
--      happens on first integration connect, on baseline seeding when
--      evidence already exists, etc.), the practice_control row stayed
--      'not_started' forever — Fortify under-reported progress.
--
--      New behavior: also walk 'not_started' rows. They get promoted to
--      compliant / partial when any satisfaction_rule passes. Rows with
--      no passing rule stay 'not_started' (we don't downgrade a fresh
--      row to non_compliant just because no evidence exists yet — that
--      would over-state the negative).
--
--   2. New SECURITY DEFINER RPC acknowledge_policy(policy_id, user_id)
--      replaces the four-call sequence in /api/policies/:id/acknowledge.
--      Performs the policy validation, idempotent ack write, and
--      remediation-task auto-resolve as a single transaction with row
--      locks. Service-role usage on that route now drops from a
--      multi-table write surface to a single RPC call.

-- ── 1. Recompute promotes not_started controls when evidence appears ───
create or replace function recompute_practice_control_status(p_practice_id uuid)
returns int
language plpgsql
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
      -- Include 'not_started' so an integration's first valid evidence
      -- promotes the row. Don't include rows in custom workflow states
      -- (in_review, etc.) — those are owned by their workflow.
      and pc.status in ('not_started', 'compliant', 'partial', 'non_compliant')
  loop
    select count(*) into v_total
      from evidence_checks ec
      where ec.control_id = v_pc.control_id and ec.satisfaction_rule is not null;

    -- A control with no rule-bearing checks shouldn't be auto-managed.
    -- Leave its manual status untouched.
    if v_total = 0 then
      continue;
    end if;

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
      -- No evidence on a not_started row: leave it not_started rather
      -- than over-stating the negative as non_compliant. Once a control
      -- has been actively worked on (its status moved off not_started),
      -- absent evidence DOES warrant non_compliant.
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

-- ── 2. acknowledge_policy SECURITY DEFINER RPC ─────────────────────────
-- Returns the acknowledgment row id + any auto-resolved task id. Single
-- transaction, takes a row lock on the policies row to avoid races where
-- a workforce member acknowledges a policy that's being retired in
-- parallel.
create or replace function acknowledge_policy(
  p_policy_id uuid,
  p_user_id uuid,
  out acknowledgment_id uuid,
  out resolved_task_id uuid,
  out already_acknowledged boolean
)
language plpgsql
security definer
as $$
declare
  v_policy_practice uuid;
  v_policy_version int;
  v_policy_status text;
  v_existing uuid;
begin
  -- Lock + load the policy
  select practice_id, version, status into v_policy_practice, v_policy_version, v_policy_status
    from policies
    where id = p_policy_id
    for update;

  if v_policy_practice is null then
    raise exception 'Policy not found' using errcode = 'P0001';
  end if;
  if v_policy_status <> 'active' then
    raise exception 'Only active policies can be acknowledged' using errcode = 'P0001';
  end if;

  -- Verify membership — the caller's practice_users row must exist for
  -- the policy's practice. The route's createAuthedServerClient check
  -- gates this; here we re-verify so the RPC is safe to call directly.
  if not exists (
    select 1 from practice_users
    where practice_id = v_policy_practice and user_id = p_user_id
  ) then
    raise exception 'No membership in policy practice' using errcode = '28000';
  end if;

  -- Idempotent — if already acknowledged at this version, return the
  -- existing row and don't insert a duplicate.
  select id into v_existing
    from policy_acknowledgments
    where policy_id = p_policy_id
      and user_id = p_user_id
      and policy_version = v_policy_version;

  if v_existing is not null then
    acknowledgment_id := v_existing;
    already_acknowledged := true;
  else
    insert into policy_acknowledgments (policy_id, practice_id, user_id, policy_version, acknowledged_at)
      values (p_policy_id, v_policy_practice, p_user_id, v_policy_version, now())
      returning id into acknowledgment_id;
    already_acknowledged := false;
  end if;

  -- Auto-resolve the matching remediation task, if any. 'done' matches
  -- the existing remediation_tasks.status check constraint
  -- (open / in_progress / blocked / done / dismissed).
  update remediation_tasks
    set status = 'done', completed_at = now()
    where practice_id = v_policy_practice
      and source = 'policy_ack'
      and subject_ref = p_policy_id::text
      and assigned_to = p_user_id
      and status in ('open', 'in_progress', 'blocked')
    returning id into resolved_task_id;

  -- Audit log entry — keeps the per-tenant trail intact.
  insert into audit_logs (practice_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (
      v_policy_practice,
      p_user_id,
      'policy.acknowledged',
      'policy',
      p_policy_id,
      jsonb_build_object(
        'policy_version', v_policy_version,
        'already_acknowledged', already_acknowledged,
        'resolved_task_id', resolved_task_id
      )
    );
end;
$$;

grant execute on function acknowledge_policy(uuid, uuid) to authenticated;
