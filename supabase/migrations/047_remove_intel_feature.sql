-- 047_remove_intel_feature.sql
--
-- The Intel feature (threat-intel feed) has been extracted into its own
-- product — TipSec: separate repo, separate Supabase project, separate
-- Vercel app. This migration removes its tables and search RPC from
-- Fortify's database. All application code that referenced these objects
-- (app/intel, app/app/threats, /api/search, /api/cron/ingest,
-- lib/ai/processor, lib/sources/*) was deleted in the same release, so
-- nothing reads or writes them anymore.
--
-- DESTRUCTIVE: drops the archived threat articles. TipSec starts with an
-- empty feed by design; this archive is intentionally not migrated.

drop function if exists search_threats(text);
drop table if exists ingestion_logs;
drop table if exists threats;
