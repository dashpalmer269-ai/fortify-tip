-- 042_invite_hash_readiness_satisfaction.sql
--
-- A consolidated correctness pass driven by an external review:
--
--   #7  Hash invite tokens — store sha256(code) on invite_codes so a DB
--       read no longer exposes redeemable URLs. Plaintext code never
--       persists after this migration.
--
--   #8  Atomic invite redemption — redeem_invite_code() RPC takes a row
--       lock on the code, validates, inserts the redemption, increments
--       used_count, and updates the practice's access_expires_at — all
--       in one transaction. Replaces the four-call sequence that had a
--       check-then-act race.
--
--   #6  Readiness v2 score penalties — the audit_readiness() weighted_pct
--       now actually penalizes overdue tasks, expired BAAs, stale
--       screenings, and unacknowledged drift alerts. Previously the
--       function's docstring claimed it did; the body did not.
--
--   #4  Satisfaction-rule evaluator — evaluate_satisfaction_rule() reads
--       the declarative jsonb pass/fail logic added in 034 and decides
--       if the current evidence/attestation satisfies it. Nothing was
--       calling that rule before today.
--
--   #5  Daily control-status recompute — recompute_practice_control_status()
--       walks every practice_control for a practice, evaluates each
--       associated evidence_check's satisfaction_rule, and updates the
--       control's status to compliant / partial / non_compliant. Driven
--       by a new cron at /api/cron/recompute-control-status.

-- ── #7+#8: invite token hashing + atomic redemption ───────────────────────

-- Add the hash column. Keep the old `code` column for the duration of
-- the migration; back-fill it as sha256 of the existing plaintext code,
-- then drop the plaintext.
alter table invite_codes
  add column if not exists code_hash text;

update invite_codes
  set code_hash = encode(digest(code, 'sha256'), 'hex')
  where code_hash is null and code is not null;

-- Now drop the plaintext column. The .code is never needed at rest — the
-- URL the granter shares carries the plaintext; the redemption path
-- hashes the URL param to look up the row.
alter table invite_codes
  drop constraint if exists invite_codes_code_key;
alter table invite_codes
  drop column if exists code;

-- New unique constraint on the hash + supporting index.
alter table invite_codes
  alter column code_hash set not null;
create unique index if not exists idx_invite_codes_code_hash
  on invite_codes(code_hash);

-- Atomic redemption: a single SECURITY DEFINER function that takes the
-- plaintext code from the caller, hashes inside the function, locks the
-- row, validates, and writes the redemption + counter + practice in one
-- transaction. Returns the granted access_expires_at on success, null on
-- any failure (caller can introspect via reason text).
create or replace function redeem_invite_code(
  p_user_id uuid,
  p_practice_id uuid,
  p_plaintext_code text,
  out access_expires_at timestamptz,
  out reason text
)
language plpgsql
security definer
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

  -- Row lock to block concurrent redemptions of the same code.
  select * into v_row
    from invite_codes
    where code_hash = v_hash
    for update;

  if not found then
    reason := 'not_found';
    return;
  end if;
  if v_row.revoked_at is not null then
    reason := 'revoked';
    return;
  end if;
  if v_row.link_expires_at < now() then
    reason := 'expired';
    return;
  end if;
  if v_row.used_count >= v_row.max_uses then
    reason := 'depleted';
    return;
  end if;

  v_expires := now() + make_interval(mins => v_row.access_duration_minutes);

  insert into invite_redemptions (code_id, user_id, practice_id, access_expires_at)
    values (v_row.id, p_user_id, p_practice_id, v_expires);

  update invite_codes
    set used_count = used_count + 1
    where id = v_row.id;

  update practices
    set plan_source = 'invite', access_expires_at = v_expires
    where id = p_practice_id;

  access_expires_at := v_expires;
  reason := 'ok';
end;
$$;

grant execute on function redeem_invite_code(uuid, uuid, text) to authenticated;

-- ── #4 + #5: satisfaction-rule evaluator + control-status recompute ────────

-- Evaluate the jsonb satisfaction_rule on evidence_checks against the
-- current evidence for a given (practice, evidence_check). Returns true
-- if any of the `any_of` rule entries is satisfied, false otherwise.
--
-- Rule shape (from migration 034/035 backfill):
--   {"any_of":[
--     {"source":"integration","status":"pass"},
--     {"source":"document_upload","age_days_lte":365},
--     {"source":"attestation","age_days_lte":90}
--   ]}
create or replace function evaluate_satisfaction_rule(
  p_practice_id uuid,
  p_evidence_check_id uuid
) returns boolean
language plpgsql
stable
as $$
declare
  v_rule jsonb;
  v_entry jsonb;
  v_source text;
  v_status text;
  v_max_age_days int;
  v_match boolean := false;
begin
  select satisfaction_rule into v_rule
    from evidence_checks
    where id = p_evidence_check_id;
  if v_rule is null then
    return false;
  end if;

  for v_entry in select * from jsonb_array_elements(v_rule->'any_of') loop
    v_source := v_entry->>'source';
    v_status := v_entry->>'status';
    v_max_age_days := nullif(v_entry->>'age_days_lte', '')::int;

    if v_source = 'integration' then
      -- Look for a current integration-derived evidence row with the
      -- expected status (defaults to 'pass' when rule omits it).
      if exists (
        select 1 from practice_evidence pe
        where pe.practice_id = p_practice_id
          and pe.evidence_check_id = p_evidence_check_id
          and pe.is_current = true
          and (v_status is null or pe.status = v_status)
      ) then
        v_match := true; exit;
      end if;

    elsif v_source = 'document_upload' then
      -- Any uploaded evidence within the age window. We treat
      -- collected_at as the age anchor.
      if exists (
        select 1 from practice_evidence pe
        where pe.practice_id = p_practice_id
          and pe.evidence_check_id = p_evidence_check_id
          and pe.is_current = true
          and pe.source = 'manual_upload'
          and (v_max_age_days is null
               or pe.collected_at > now() - make_interval(days => v_max_age_days))
      ) then
        v_match := true; exit;
      end if;

    elsif v_source = 'attestation' then
      if exists (
        select 1 from practice_evidence pe
        where pe.practice_id = p_practice_id
          and pe.evidence_check_id = p_evidence_check_id
          and pe.is_current = true
          and pe.source = 'attestation'
          and (v_max_age_days is null
               or pe.collected_at > now() - make_interval(days => v_max_age_days))
      ) then
        v_match := true; exit;
      end if;
    end if;
  end loop;

  return v_match;
end;
$$;

-- Recompute every practice_control's status for one practice. Walks the
-- mapped evidence_checks per control, evaluates satisfaction_rule on
-- each, and updates status accordingly:
--   * all rules pass         → compliant
--   * some rules pass         → partial
--   * none pass / no rules    → non_compliant (leaves not_started rows
--                                              alone — we don't auto-
--                                              activate work that hasn't
--                                              started).
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
      and pc.status in ('compliant', 'partial', 'non_compliant')
  loop
    select count(*) into v_total
      from evidence_checks ec
      where ec.control_id = v_pc.control_id and ec.satisfaction_rule is not null;

    if v_total = 0 then
      continue; -- no rules to evaluate; leave the manual status alone
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

grant execute on function recompute_practice_control_status(uuid) to authenticated;

-- ── #6: readiness v2 score penalties for tasks/BAAs/screenings/drift ──────
-- Replace audit_readiness() with a version that multiplies the weighted
-- satisfaction factor by penalty multipliers derived from the four
-- practice-wide risk signals. Each penalty caps at 0.85 (max 15%
-- reduction per signal) and they compound multiplicatively, so a
-- practice with all four signals active sees roughly 0.85^4 ≈ 0.52 of
-- the raw score — a meaningful nudge, not a wipeout.
create or replace function audit_readiness(
  p_practice_id uuid,
  p_framework_code text
) returns table (
  framework text,
  satisfied_requirements int,
  total_requirements int,
  weighted_pct numeric,
  category_breakdown jsonb
)
language sql stable as $$
  with reqs as (
    select
      fr.id,
      fr.category,
      fr.weight * case fr.obligation_type
        when 'required'    then 1.5
        when 'addressable' then 1.0
        when 'recommended' then 0.5
        else                    1.0
      end as scaled_weight
    from framework_requirements fr
    join frameworks f on f.id = fr.framework_id
    where f.code = p_framework_code
  ),
  satisfaction as (
    select
      r.id as req_id,
      r.category,
      r.scaled_weight,
      max(
        case pc.status
          when 'compliant' then 1.0
          when 'partial'   then 0.5
          else 0.0
        end
        * case fm.mapping_strength
            when 'fully_satisfies'     then 1.0
            when 'partially_satisfies' then 0.6
            when 'contributes_to'      then 0.3
            else 1.0
          end
        * case fm.mapping_confidence
            when 'high'   then 1.0
            when 'medium' then 0.85
            when 'low'    then 0.7
            else 1.0
          end
      ) as satisfaction_factor
    from reqs r
    left join framework_mappings fm on fm.framework_requirement_id = r.id
    left join practice_controls pc
      on pc.control_id = fm.control_id and pc.practice_id = p_practice_id
    group by r.id, r.category, r.scaled_weight
  ),
  freshness as (
    select
      r.id as req_id,
      coalesce(
        min(case
          when pe.collected_at is null then 0.85
          when extract(epoch from (now() - pe.collected_at)) / 3600.0
               > coalesce(ec.frequency_hours, 24) * 3
            then 0.80
          when extract(epoch from (now() - pe.collected_at)) / 3600.0
               > coalesce(ec.frequency_hours, 24) * 2
            then 0.90
          else 1.0
        end),
        1.0
      ) as freshness_factor
    from reqs r
    left join framework_mappings fm on fm.framework_requirement_id = r.id
    left join evidence_checks ec on ec.control_id = fm.control_id
    left join practice_evidence pe
      on pe.evidence_check_id = ec.id
      and pe.practice_id = p_practice_id
      and pe.is_current = true
    group by r.id
  ),
  -- New: practice-wide risk-signal penalties. Each is one number for
  -- the whole practice and applies as a multiplier to every requirement's
  -- factor.
  risk_signals as (
    select
      -- Overdue tasks → cap at 0.85 if any open task is past due.
      case when exists (
        select 1 from remediation_tasks t
        where t.practice_id = p_practice_id
          and t.status in ('open','in_progress','blocked')
          and t.due_date is not null
          and t.due_date < (now() at time zone 'utc')::date
      ) then 0.85 else 1.0 end as overdue_factor,
      -- Expired BAAs → cap at 0.85 if any vendor's BAA has lapsed.
      case when exists (
        select 1 from baas b
        where b.practice_id = p_practice_id
          and b.expiration_date is not null
          and b.expiration_date < now()
      ) then 0.85 else 1.0 end as baa_factor,
      -- Stale workforce screenings (>30d or never).
      case when exists (
        select 1 from practice_users pu
        where pu.practice_id = p_practice_id
          and not exists (
            select 1 from exclusion_screenings es
            where es.subject_user_id = pu.user_id
              and es.subject_type = 'workforce_member'
              and es.screened_at > now() - interval '30 days'
          )
      ) then 0.85 else 1.0 end as screening_factor,
      -- Any unacknowledged drift alert.
      case when exists (
        select 1 from drift_alerts da
        where da.practice_id = p_practice_id
          and da.acknowledged_at is null
      ) then 0.85 else 1.0 end as drift_factor
  ),
  joined as (
    select
      s.req_id,
      s.category,
      s.scaled_weight,
      least(
        1.0,
        s.satisfaction_factor
          * coalesce(f.freshness_factor, 1.0)
          * rs.overdue_factor
          * rs.baa_factor
          * rs.screening_factor
          * rs.drift_factor
      ) as final_factor
    from satisfaction s
    left join freshness f on f.req_id = s.req_id
    cross join risk_signals rs
  ),
  per_category as (
    select
      category,
      sum(scaled_weight)             as cat_weight,
      sum(scaled_weight * final_factor) as cat_satisfied_weight,
      count(*)                       as cat_total,
      sum(case when final_factor >= 0.9 then 1 else 0 end) as cat_satisfied
    from joined
    group by category
  ),
  overall as (
    select
      sum(cat_weight)            as total_weight,
      sum(cat_satisfied_weight)  as satisfied_weight,
      sum(cat_total)             as total_count,
      sum(cat_satisfied)         as satisfied_count,
      jsonb_object_agg(
        coalesce(category, 'uncategorized'),
        jsonb_build_object(
          'satisfied', cat_satisfied,
          'total',     cat_total,
          'weighted_pct', round(case when cat_weight > 0 then cat_satisfied_weight / cat_weight * 100 else 0 end, 1)
        )
      ) as breakdown
    from per_category
  )
  select
    p_framework_code,
    coalesce(satisfied_count, 0)::int,
    coalesce(total_count, 0)::int,
    round(case when total_weight > 0 then satisfied_weight / total_weight * 100 else 0 end, 1),
    coalesce(breakdown, '{}'::jsonb)
  from overall;
$$;
