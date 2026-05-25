-- 011_user_delete_cascade.sql
-- Allow auth.users rows to be deleted by setting historical user-reference
-- columns to ON DELETE SET NULL. Without this, deleting a user via the
-- Supabase dashboard fails with "database error deleting user" because of
-- FK violations on audit_logs.actor_user_id, etc.
--
-- We use SET NULL (not CASCADE) on these columns because we want the
-- historical audit / evidence / report rows to survive the user being
-- deleted -- we just blank out the author.

do $$
declare
  fk record;
  drop_sql text;
  add_sql text;
  pairs jsonb := jsonb_build_array(
    jsonb_build_object('table','audit_logs',          'column','actor_user_id'),
    jsonb_build_object('table','practice_evidence',   'column','collected_by'),
    jsonb_build_object('table','remediation_tasks',   'column','owner_user_id'),
    jsonb_build_object('table','remediation_tasks',   'column','assigned_to'),
    jsonb_build_object('table','drift_alerts',        'column','acknowledged_by'),
    jsonb_build_object('table','risk_assessments',    'column','assessor_user_id'),
    jsonb_build_object('table','reports',             'column','generated_by')
  );
  p jsonb;
  t text;
  c text;
begin
  for p in select * from jsonb_array_elements(pairs) loop
    t := p->>'table';
    c := p->>'column';
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    -- Find the existing FK on (table, column)
    select tc.constraint_name into fk
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = t
      and kcu.column_name = c
    limit 1;
    if fk.constraint_name is null then
      continue;
    end if;
    drop_sql := format('alter table public.%I drop constraint %I', t, fk.constraint_name);
    add_sql  := format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      t, fk.constraint_name, c
    );
    execute drop_sql;
    execute add_sql;
  end loop;
end $$;
