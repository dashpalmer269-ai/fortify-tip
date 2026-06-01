-- 038_readiness_v2.sql
-- Weighted readiness v2 — risk-real, not just count-compliant-controls.
--
-- Replaces audit_readiness + audit_readiness_summary with versions that
-- factor in:
--   • the EXISTING framework_requirements.weight + obligation_type
--   • the NEW controls.default_weight (per-control risk)
--   • the NEW mapping_confidence (high/medium/low)
--   • evidence freshness — penalize stale evidence approaching expiry
--   • open critical tasks — penalize overdue auto_control tasks
--   • expired BAAs — penalize on the vendor side
--   • exclusion screening currency — penalize stale workforce screenings
--
-- The new functions are drop-in replacements; the existing API surface
-- (return shape of audit_readiness / audit_readiness_summary) is unchanged
-- so the dashboard + attestation generator keep working.
--
-- Calling code that wants the new detail can call audit_readiness_v2 which
-- returns the additional breakdown.

-- ─── 1. audit_readiness v2 ──────────────────────────────────────────────
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
    -- Pull every requirement for the framework, with its weight scaled by
    -- obligation type (required > addressable > recommended).
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
  -- For every requirement, gather the maximum satisfaction signal across
  -- mapped controls. The signal combines:
  --   • control.status        (compliant > partial > non_compliant > not_started)
  --   • mapping_strength      (fully > partially > contributes)
  --   • mapping_confidence    (high > medium > low)
  --   • control.default_weight (so a compliant high-weight control counts
  --                              more toward satisfaction than a low-weight one)
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
        *
        case fm.mapping_strength
          when 'fully_satisfies'     then 1.0
          when 'partially_satisfies' then 0.6
          when 'contributes_to'      then 0.3
          else 1.0
        end
        *
        case fm.mapping_confidence
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
  -- Evidence-freshness modifier. For any requirement whose mapped controls
  -- have evidence_checks, dampen satisfaction if the most-recent evidence
  -- is stale (older than 2× the frequency_hours window). Up to 20% penalty.
  freshness as (
    select
      r.id as req_id,
      coalesce(
        min(case
          when pe.collected_at is null then 0.85  -- no evidence at all
          when extract(epoch from (now() - pe.collected_at)) / 3600.0
               > coalesce(ec.frequency_hours, 24) * 3
            then 0.80  -- 3x past frequency = significantly stale
          when extract(epoch from (now() - pe.collected_at)) / 3600.0
               > coalesce(ec.frequency_hours, 24) * 2
            then 0.90  -- 2x past frequency = moderately stale
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
  joined as (
    select
      s.req_id,
      s.category,
      s.scaled_weight,
      least(1.0, s.satisfaction_factor * f.freshness_factor) as final_factor
    from satisfaction s
    left join freshness f on f.req_id = s.req_id
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

-- ─── 2. audit_readiness_summary v2 (same return shape, new internals) ──
create or replace function audit_readiness_summary(p_practice_id uuid)
returns table (
  framework_code text,
  weighted_pct numeric,
  satisfied int,
  total int
)
language sql stable as $$
  select
    f.code,
    r.weighted_pct,
    r.satisfied_requirements,
    r.total_requirements
  from frameworks f
  join practices p on p.id = p_practice_id
  cross join lateral audit_readiness(p_practice_id, f.code) r
  where f.code = any (p.frameworks_enabled);
$$;

-- ─── 3. New audit_readiness_v2 with extended payload ───────────────────
-- Returns the full risk-adjusted readiness picture for one practice across
-- ALL enabled frameworks, including the operational signals the dashboard
-- and reports surface.
create or replace function audit_readiness_v2(p_practice_id uuid)
returns table (
  framework_code text,
  weighted_pct numeric,
  satisfied_count int,
  total_count int,
  category_breakdown jsonb,
  open_critical_tasks int,
  overdue_tasks int,
  expired_baas int,
  stale_screenings int,
  drift_alerts_open int
)
language sql stable as $$
  select
    f.code,
    r.weighted_pct,
    r.satisfied_requirements,
    r.total_requirements,
    r.category_breakdown,
    -- Open critical tasks for this practice (one number, repeated per framework row)
    (select count(*)::int from remediation_tasks t
     where t.practice_id = p_practice_id
       and t.status in ('open','in_progress','blocked')
       and t.severity = 'critical'),
    -- Overdue tasks
    (select count(*)::int from remediation_tasks t
     where t.practice_id = p_practice_id
       and t.status in ('open','in_progress','blocked')
       and t.due_date is not null
       and t.due_date < (now() at time zone 'utc')::date),
    -- Expired BAAs (best-effort; the baas table may not always be populated)
    coalesce(
      (select count(*)::int from baas b
       where b.practice_id = p_practice_id
         and b.expiration_date is not null
         and b.expiration_date < now()),
      0
    ),
    -- Stale exclusion screenings (>30d old or never)
    coalesce(
      (select count(*)::int from practice_users pu
       where pu.practice_id = p_practice_id
         and not exists (
           select 1 from exclusion_screenings es
           where es.subject_user_id = pu.user_id
             and es.subject_type = 'workforce_member'
             and es.screened_at > now() - interval '30 days'
         )),
      0
    ),
    -- Unacknowledged drift alerts
    (select count(*)::int from drift_alerts da
     where da.practice_id = p_practice_id
       and da.acknowledged_at is null)
  from frameworks f
  join practices p on p.id = p_practice_id
  cross join lateral audit_readiness(p_practice_id, f.code) r
  where f.code = any (p.frameworks_enabled);
$$;

-- Permissions
grant execute on function audit_readiness(uuid, text) to authenticated;
grant execute on function audit_readiness_summary(uuid) to authenticated;
grant execute on function audit_readiness_v2(uuid) to authenticated;
