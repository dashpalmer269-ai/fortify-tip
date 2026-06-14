-- 046_recompute_throttle.sql
--
-- Scalability: the admin dashboard is the hottest page in the app, and it
-- was calling recompute_practice_control_status() on EVERY render. That
-- function evaluates the satisfaction rule of every evidence_check of
-- every control for the practice and writes any status changes — fine
-- once, wasteful on every page load, and a real bottleneck at thousands
-- of concurrent users.
--
-- This adds a throttle: recompute_control_status_if_stale() recomputes
-- only when the practice's controls haven't been recomputed within the
-- last N minutes (default 15). It row-locks the practice first so two
-- concurrent dashboard loads can't both recompute. The dashboard uses
-- this; reports + attestations keep calling the unconditional recompute
-- because they want guaranteed freshness at generation time and run
-- infrequently. The nightly cron remains the backstop.
--
-- Net effect: dashboard freshness is bounded to <= N minutes (vs the
-- prior choice of "every load" — expensive — or "nightly only" — up to
-- 24h stale), and the expensive operation runs at most once per N
-- minutes per practice no matter how many people load the dashboard.

alter table practices
  add column if not exists controls_recomputed_at timestamptz;

create or replace function recompute_control_status_if_stale(
  p_practice_id uuid,
  p_max_age_minutes int default 15
) returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_last timestamptz;
  v_count int := 0;
begin
  -- Lock the practice row so concurrent callers serialize; the loser sees
  -- the fresh timestamp and skips.
  select controls_recomputed_at into v_last
    from practices where id = p_practice_id for update;

  if v_last is null or v_last < now() - make_interval(mins => p_max_age_minutes) then
    v_count := recompute_practice_control_status(p_practice_id);
    update practices set controls_recomputed_at = now() where id = p_practice_id;
  end if;

  return v_count;
end;
$$;

grant execute on function recompute_control_status_if_stale(uuid, int) to authenticated;

-- ── Hot-path index ────────────────────────────────────────────────────────
-- recompute_practice_control_status() and the evaluator both filter
-- evidence_checks by control_id ("where ec.control_id = X and
-- satisfaction_rule is not null"), once per practice_control. evidence_checks
-- is a GLOBAL table (every check across every framework), so without this
-- index each lookup is a sequential scan — O(controls × all_checks) per
-- recompute. The partial predicate keeps the index tight to the rows the
-- evaluator actually scans.
create index if not exists idx_evidence_checks_control
  on evidence_checks(control_id)
  where satisfaction_rule is not null;
