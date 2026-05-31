-- 027_evidence_storage_and_checks.sql
-- Enable the document-upload + manual-attestation legs of the continuous
-- monitoring loop. Three changes:
--
-- 1. Private `evidence` storage bucket with RLS scoped to practice membership.
--    Path convention: {practice_id}/{control_id}/{uuid}-{filename}.
--
-- 2. Auto-seed an evidence_check row for every customer-owned control whose
--    automation_status is 'document_upload' or 'manual_attestation' but
--    doesn't yet have a check. After this every operational control has at
--    least one verifiable target, so the cron's recency / renewal-cadence
--    runners can produce evidence rows for them.
--
-- 3. Index on practice_evidence.evidence_file_url so the verifier can look
--    up "most recent uploaded document for check X" fast.

-- ── A. Storage bucket ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- RLS on storage.objects for this bucket: only practice members with the
-- practice_id as the first path segment can read/write.
drop policy if exists evidence_member_read on storage.objects;
create policy evidence_member_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and user_is_practice_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists evidence_admin_write on storage.objects;
create policy evidence_admin_write on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and user_is_practice_admin((split_part(name, '/', 1))::uuid)
  );

drop policy if exists evidence_admin_delete on storage.objects;
create policy evidence_admin_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and user_is_practice_admin((split_part(name, '/', 1))::uuid)
  );

-- ── B. Auto-seed evidence_check for every doc/attestation control ──────
do $$
declare
  c record;
  freq_hours int := 24;
  max_age int;
  method text;
  method_suffix text;
  ck_key text;
  ck_title text;
  ck_desc text;
begin
  for c in
    select id, control_key, automation_status
    from controls
    where audience = 'customer'
      and active = true
      and automation_status in ('document_upload', 'manual_attestation')
  loop
    -- Skip if any evidence_check already exists for this control
    if exists (select 1 from evidence_checks where control_id = c.id) then
      continue;
    end if;

    method := c.automation_status;

    -- Renewal / max-age policy:
    --   quarterly attestations (ACC-004, BCK-002) → 90 days
    --   everything else → 365 days
    if c.control_key in ('ACC-004', 'BCK-002') then
      max_age := 90;
    else
      max_age := 365;
    end if;

    if method = 'document_upload' then
      method_suffix := 'document';
      ck_desc := 'Verifies the practice has uploaded a current document for this control within the last ' || max_age::text || ' days.';
    else
      method_suffix := 'attestation';
      ck_desc := 'Verifies the practice has attested to this control within the last ' || max_age::text || ' days.';
    end if;

    ck_key   := lower(replace(c.control_key, '-', '_')) || '_' || method_suffix;
    ck_title := c.control_key || ' ' || method_suffix;

    insert into evidence_checks (
      control_id, check_key, title, description,
      collection_method, source_integration, frequency_hours,
      check_config, pass_criteria
    ) values (
      c.id, ck_key, ck_title, ck_desc,
      method, null, freq_hours,
      jsonb_build_object('max_age_days', max_age),
      jsonb_build_object('value', max_age)
    )
    on conflict (control_id, check_key) do nothing;
  end loop;
end $$;

-- ── C. Index for fast "most recent uploaded file" lookups ──────────────
create index if not exists idx_practice_evidence_file_url
  on practice_evidence (practice_id, evidence_check_id, collected_at desc)
  where evidence_file_url is not null;

comment on column practice_evidence.evidence_file_url is
  'Storage path within the evidence bucket: {practice_id}/{control_id}/{uuid}-{filename}. Set by the upload finalize endpoint.';
