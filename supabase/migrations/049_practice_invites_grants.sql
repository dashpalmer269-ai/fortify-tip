-- 049_practice_invites_grants.sql
-- Follow-up to 048: this database does not apply default privileges to new
-- tables (the same failure mode migration 009 fixed in bulk), so
-- practice_invites was created without any table GRANTs — every API-role
-- access returned "permission denied", including service_role.
--
-- service_role: full CRUD (the API routes' only write path; BYPASSRLS).
-- authenticated: SELECT only — RLS (048's admin-read policy) scopes rows.
-- anon: nothing — the public /join page reads via the server-side service
-- client after hashing the URL token.

grant select, insert, update, delete on public.practice_invites to service_role;
grant select on public.practice_invites to authenticated;
