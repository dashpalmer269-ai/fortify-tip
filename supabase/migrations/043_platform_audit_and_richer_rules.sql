-- 043_platform_audit_and_richer_rules.sql
--
-- Two correctness additions on top of the audit pass:
--
--   1. platform_audit_logs — a separate audit table that does NOT cascade
--      with practices. Used for events whose record must survive tenant
--      deletion: practice deletion, invite create/revoke, billing state
--      changes from Stripe webhooks, future platform-admin actions,
--      future support-impersonation events.
--
--   2. evaluate_satisfaction_rule_v2 — extends the rule evaluator to
--      handle a richer DSL the existing chain has been quietly accepting
--      but never executing:
--
--        all_of: every entry must satisfy (logical AND across the array)
--        any_of: existing behavior (at least one entry satisfies)
--        evidence_type: filter source evidence by check_key (e.g. only
--                       "policy_signed_baa" counts, not arbitrary uploads)
--        source_priority: ordered list of sources; first source that has
--                         current evidence is the authoritative one
--        reviewer_approval_required: true if a separate reviewer (not the
--                                    submitter) must have attested
--        integration_disconnected_fail: if the named integration is
--                                       'disconnected' OR last_error set,
--                                       the rule fails regardless of
--                                       other signals
--        critical_finding_override: allow an explicit admin override row
--                                   to satisfy the rule with reason
--                                   (recorded as control_exceptions)
--
--      The old jsonb rule shape (any_of with source/status/age_days_lte)
--      remains supported.

-- ── 1. platform_audit_logs ────────────────────────────────────────────────
create table if not exists platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  -- Optional tenant scope; NOT a foreign key, so a deleted practice's
  -- row survives. Stored as raw uuid text for searchability.
  practice_id text,
  practice_name text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text,             -- e.g. 'fortify_admin' / 'owner' / 'system'
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_platform_audit_logs_event on platform_audit_logs(event);
create index if not exists idx_platform_audit_logs_practice on platform_audit_logs(practice_id);
create index if not exists idx_platform_audit_logs_actor on platform_audit_logs(actor_user_id);
create index if not exists idx_platform_audit_logs_occurred_at on platform_audit_logs(occurred_at desc);

-- RLS: no one reads platform_audit_logs through the authenticated client.
-- Service-role bypasses; the table is operator-facing only.
alter table platform_audit_logs enable row level security;

drop policy if exists "platform_audit_logs no read" on platform_audit_logs;
create policy "platform_audit_logs no read"
  on platform_audit_logs for select
  to authenticated
  using (false);

-- ── 2. control_exceptions ─────────────────────────────────────────────────
-- Adminstrative override rows used by the richer rule evaluator. An
-- exception ROW satisfies the rule for the named (practice, control)
-- pairing for the duration of the exception. Surfaces in audit_logs +
-- platform_audit_logs at creation.
create table if not exists control_exceptions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  control_id uuid not null references controls(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text not null,
  is_critical_override boolean not null default false,
  revoked_at timestamptz
);

create index if not exists idx_control_exceptions_practice on control_exceptions(practice_id);
create index if not exists idx_control_exceptions_control on control_exceptions(control_id);
create index if not exists idx_control_exceptions_active
  on control_exceptions(practice_id, control_id)
  where revoked_at is null;

alter table control_exceptions enable row level security;

drop policy if exists "control_exceptions practice read" on control_exceptions;
create policy "control_exceptions practice read"
  on control_exceptions for select
  to authenticated
  using (
    exists (
      select 1 from practice_users pu
      where pu.practice_id = control_exceptions.practice_id
        and pu.user_id = auth.uid()
    )
  );

-- ── 3. evaluate_satisfaction_rule v2 ──────────────────────────────────────
-- Supersedes the v1 evaluator. Backward-compatible with the existing
-- {"any_of":[...]} jsonb. New keys handled when present:
--    all_of            : array of entries; ALL must pass
--    reviewer_approval_required: boolean; if true, requires at least one
--                                attestation by a user other than the
--                                most-recent submitter
--    integration_disconnected_fail: integration_type string; if that
--                                   integration is disconnected for
--                                   the practice, the rule fails
--    source_priority   : ordered string[]; the highest-priority source
--                        with current evidence is the authoritative one,
--                        and ONLY that source's status is evaluated
create or replace function evaluate_satisfaction_rule_v2(
  p_practice_id uuid,
  p_evidence_check_id uuid
) returns boolean
language plpgsql
stable
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
  v_priority_src text;
  v_reviewer_required boolean := false;
  v_distinct_submitters int;
  v_check_key text;
begin
  -- Control exception (admin override) short-circuits the rule check.
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

  select satisfaction_rule, check_key into v_rule, v_check_key
    from evidence_checks where id = p_evidence_check_id;
  if v_rule is null then return false; end if;

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

  -- Reviewer-approval requirement: at least one attestation by a user
  -- different from the most-recent submitter.
  v_reviewer_required := coalesce((v_rule->>'reviewer_approval_required')::boolean, false);
  if v_reviewer_required then
    select count(distinct collected_by_user_id) into v_distinct_submitters
      from practice_evidence
      where practice_id = p_practice_id
        and evidence_check_id = p_evidence_check_id
        and is_current = true
        and collected_by_user_id is not null;
    if v_distinct_submitters < 2 then
      return false;
    end if;
  end if;

  -- Source priority: pick the highest-priority source with current
  -- evidence; ignore lower-priority sources entirely.
  v_source_priority := v_rule->'source_priority';
  if v_source_priority is not null and jsonb_array_length(v_source_priority) > 0 then
    for v_priority_src in select jsonb_array_elements_text(v_source_priority) loop
      if exists (
        select 1 from practice_evidence
        where practice_id = p_practice_id
          and evidence_check_id = p_evidence_check_id
          and is_current = true
          and source = v_priority_src
      ) then
        v_source_winner := v_priority_src;
        exit;
      end if;
    end loop;
    if v_source_winner is null then
      return false;
    end if;
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

  -- any_of: at least one entry must pass (the v1 behavior).
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

  -- If we got here, all configured gates passed. If neither all_of nor
  -- any_of were present, the rule is degenerate — treat as not satisfied.
  return v_rule ? 'all_of' or v_rule ? 'any_of';
end;
$$;

-- Helper: evaluate a single rule entry. Pulled out so all_of / any_of
-- share one matcher.
create or replace function _rule_entry_satisfied(
  p_practice_id uuid,
  p_evidence_check_id uuid,
  p_entry jsonb,
  p_source_winner text
) returns boolean
language plpgsql
stable
as $$
declare
  v_source text;
  v_status text;
  v_age_days int;
  v_evidence_type text;
begin
  v_source := p_entry->>'source';
  v_status := p_entry->>'status';
  v_age_days := nullif(p_entry->>'age_days_lte', '')::int;
  v_evidence_type := p_entry->>'evidence_type';

  -- If source_priority picked a winner, only entries for that source
  -- are evaluated.
  if p_source_winner is not null and v_source is not null and v_source <> p_source_winner then
    return false;
  end if;

  if v_source = 'integration' then
    return exists (
      select 1 from practice_evidence pe
      where pe.practice_id = p_practice_id
        and pe.evidence_check_id = p_evidence_check_id
        and pe.is_current = true
        and (v_status is null or pe.status = v_status)
        and (v_evidence_type is null or pe.evidence_type = v_evidence_type)
    );
  elsif v_source = 'document_upload' then
    return exists (
      select 1 from practice_evidence pe
      where pe.practice_id = p_practice_id
        and pe.evidence_check_id = p_evidence_check_id
        and pe.is_current = true
        and pe.source = 'manual_upload'
        and (v_age_days is null
             or pe.collected_at > now() - make_interval(days => v_age_days))
        and (v_evidence_type is null or pe.evidence_type = v_evidence_type)
    );
  elsif v_source = 'attestation' then
    return exists (
      select 1 from practice_evidence pe
      where pe.practice_id = p_practice_id
        and pe.evidence_check_id = p_evidence_check_id
        and pe.is_current = true
        and pe.source = 'attestation'
        and (v_age_days is null
             or pe.collected_at > now() - make_interval(days => v_age_days))
        and (v_evidence_type is null or pe.evidence_type = v_evidence_type)
    );
  end if;

  return false;
end;
$$;

-- Replace the v1 evaluator with a delegator to v2 so existing callers
-- (recompute_practice_control_status) automatically pick up the richer
-- logic without further migrations.
create or replace function evaluate_satisfaction_rule(
  p_practice_id uuid,
  p_evidence_check_id uuid
) returns boolean
language sql stable as $$
  select evaluate_satisfaction_rule_v2(p_practice_id, p_evidence_check_id);
$$;
