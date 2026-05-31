-- 031_integration_framework_extension.sql
-- Extend the integration framework to support every provider category a
-- healthcare practice might actually use:
--   identity      — M365 / Entra, Google Workspace, Okta, Azure AD
--   cloud_infra   — AWS, GCP, Azure
--   backup        — Datto, Acronis, Cove/N-able, Veeam, Azure Backup
--   ehr_pms       — Athenahealth, AdvancedMD, Dentrix, Kareo/Tebra, DrChrono
--   rmm_msp       — NinjaOne, ConnectWise Automate, Datto RMM, Atera,
--                   Syncro, N-able RMM
--   signing       — DocuSign, Dropbox Sign
--   task_tracker  — Jira, Linear, Asana, Trello
--
-- The framework supports all of them today. Real API clients are wired
-- per-provider over time — until then a practice can attest manually for
-- providers in their stack and the evidence flow runs the same loop.
--
-- "Fortify must not store or pull PHI" remains the absolute rule. For
-- EHR/PMS providers in particular: we track admin access, BAA status,
-- audit-log availability, and vendor risk — never the clinical records
-- themselves.

-- 1. Drop the existing CHECK constraint
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'integrations'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%integration_type%';
  if conname is not null then
    execute format('alter table integrations drop constraint %I', conname);
  end if;
end $$;

-- 2. Re-add with the full extended provider list
alter table integrations
  add constraint integrations_integration_type_check
  check (integration_type in (
    -- Identity
    'microsoft_365', 'google_workspace', 'okta', 'azure_ad',
    -- Cloud infrastructure
    'aws', 'gcp', 'azure',
    -- Backup / DR
    'datto', 'acronis', 'cove_nable', 'veeam', 'azure_backup',
    -- EHR / Practice Management (NO PHI — metadata only)
    'athenahealth', 'advancedmd', 'dentrix', 'kareo_tebra', 'drchrono', 'ehr_other',
    -- RMM / MSP
    'ninjaone', 'connectwise_rmm', 'connectwise_automate', 'datto_rmm', 'atera', 'syncro', 'nable_rmm',
    -- E-signature
    'docusign', 'dropbox_sign',
    -- Task / project tracker
    'jira', 'linear', 'asana', 'trello'
  ));

-- 3. Add the category column. NULL until classified — backfilled below.
alter table integrations
  add column if not exists category text check (category in (
    'identity', 'cloud_infra', 'backup', 'ehr_pms', 'rmm_msp', 'signing', 'task_tracker'
  ));

-- 4. Backfill category for existing rows + future inserts via a trigger
update integrations set category = case
  when integration_type in ('microsoft_365','google_workspace','okta','azure_ad') then 'identity'
  when integration_type in ('aws','gcp','azure') then 'cloud_infra'
  when integration_type in ('datto','acronis','cove_nable','veeam','azure_backup') then 'backup'
  when integration_type in ('athenahealth','advancedmd','dentrix','kareo_tebra','drchrono','ehr_other') then 'ehr_pms'
  when integration_type in ('ninjaone','connectwise_rmm','connectwise_automate','datto_rmm','atera','syncro','nable_rmm') then 'rmm_msp'
  when integration_type in ('docusign','dropbox_sign') then 'signing'
  when integration_type in ('jira','linear','asana','trello') then 'task_tracker'
end
where category is null;

-- 5. Trigger to keep category in sync on insert / update of integration_type
create or replace function set_integration_category()
returns trigger language plpgsql as $$
begin
  new.category := case
    when new.integration_type in ('microsoft_365','google_workspace','okta','azure_ad') then 'identity'
    when new.integration_type in ('aws','gcp','azure') then 'cloud_infra'
    when new.integration_type in ('datto','acronis','cove_nable','veeam','azure_backup') then 'backup'
    when new.integration_type in ('athenahealth','advancedmd','dentrix','kareo_tebra','drchrono','ehr_other') then 'ehr_pms'
    when new.integration_type in ('ninjaone','connectwise_rmm','connectwise_automate','datto_rmm','atera','syncro','nable_rmm') then 'rmm_msp'
    when new.integration_type in ('docusign','dropbox_sign') then 'signing'
    when new.integration_type in ('jira','linear','asana','trello') then 'task_tracker'
    else null
  end;
  return new;
end $$;

drop trigger if exists trg_integrations_set_category on integrations;
create trigger trg_integrations_set_category
  before insert or update of integration_type on integrations
  for each row execute function set_integration_category();

create index if not exists idx_integrations_category on integrations(practice_id, category);

comment on column integrations.category is
  'Provider category — derived from integration_type by trigger. Lets the UI group integrations and the dashboard factor evidence by stack area.';
