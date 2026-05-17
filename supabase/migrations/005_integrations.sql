-- ─────────────────────────────────────────────────────────────────────────────
-- 005_integrations.sql
-- Per-practice integration connections (Microsoft 365 first; pattern extends
-- to AWS / Datto / RMM in later phases).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  integration_type text not null check (integration_type in
    ('microsoft_365','aws','datto','connectwise','okta','azure_ad')),
  status text not null check (status in ('connected','disconnected','error')) default 'disconnected',
  external_account_id text,             -- M365 tenant id, AWS account id, etc.
  display_name text,
  scopes text[],
  encrypted_credentials jsonb,          -- access_token, refresh_token, expires_at, etc.
                                        -- Real-world: use Supabase Vault or app-level KMS.
                                        -- For now we store via service-role and never expose via RLS.
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (practice_id, integration_type)
);

create index if not exists idx_integrations_practice on integrations(practice_id);

drop trigger if exists integrations_touch on integrations;
create trigger integrations_touch before update on integrations
  for each row execute function touch_updated_at();

alter table integrations enable row level security;

-- Members can SEE that an integration exists (status, type) but NOT the
-- encrypted_credentials column. Read at the API level instead, masking the
-- credential blob server-side before sending to the client.
drop policy if exists integrations_member_read on integrations;
create policy integrations_member_read on integrations for select using (
  practice_id in (select practice_id from practice_users where user_id = auth.uid())
);

drop policy if exists integrations_owner_admin_write on integrations;
create policy integrations_owner_admin_write on integrations for all using (
  practice_id in (select practice_id from practice_users
                  where user_id = auth.uid()
                    and role in ('owner','admin'))
);

grant all on integrations to service_role;
