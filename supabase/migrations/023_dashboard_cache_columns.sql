-- 023_dashboard_cache_columns.sql
-- Performance: cache the dashboard's "practice in a sentence" AI narrative and
-- throttle the task generator so it doesn't fire on every page load.
--
-- The narrative is an Opus 4.8 call (~300 input + 100 output tokens) — at
-- Opus pricing this is the single most expensive piece of the dashboard
-- render. The state hash captures the inputs the narrative is derived from
-- (overall_pct, critical_open count, top-task signature). Same hash → reuse
-- cached prose; new hash → regenerate.
--
-- tasks_last_generated_at lets the dashboard skip task regeneration when it
-- ran within the last 10 minutes. The verify-compliance cron sets this too,
-- and bypasses the throttle on its own runs since it has fresh signal.

alter table practices
  add column if not exists dashboard_narrative text,
  add column if not exists dashboard_narrative_state_hash text,
  add column if not exists dashboard_narrative_at timestamptz,
  add column if not exists tasks_last_generated_at timestamptz;

comment on column practices.dashboard_narrative is
  'Cached Opus 4.8 "practice in a sentence" prose. Invalidated when dashboard_narrative_state_hash no longer matches current posture.';
comment on column practices.tasks_last_generated_at is
  'When generateTasksForPractice last ran for this practice. Dashboard throttle: skip regeneration within 10min.';
