-- 050_repair_missing_table_grants.sql
-- Systemic repair for the default-privileges quirk (see 009 and 049): a
-- schema-wide sweep found four tables where service_role holds NO write
-- privileges. Live consequences before this fix:
--   - invite_codes:        Fortify-admin demo-invite CREATION failed
--   - invite_redemptions:  service-role bookkeeping paths failed
--   - control_exceptions:  operator exception writes failed
--   - platform_audit_logs: practice-deletion forensic row silently lost
--     (verified live 2026-07-06: delete succeeded, no platform.deleted row)
--
-- RLS remains the gate for authenticated; service_role has BYPASSRLS but
-- still needs table privileges.

grant select, insert, update, delete on public.invite_codes to service_role;
grant select, insert, update, delete on public.invite_redemptions to service_role;
grant select, insert, update, delete on public.control_exceptions to service_role;
grant select, insert, update, delete on public.platform_audit_logs to service_role;

-- Belt-and-braces: make sure the sequence-less uuid tables above are the
-- only gap. (Run the sweep below after applying; it must return 0 rows.)
--
-- select t.tablename
-- from pg_tables t
-- where t.schemaname = 'public'
--   and not exists (
--     select 1 from information_schema.role_table_grants g
--     where g.table_schema = 'public' and g.table_name = t.tablename
--       and g.grantee = 'service_role' and g.privilege_type = 'INSERT');
