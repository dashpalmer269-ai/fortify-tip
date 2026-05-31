-- 028_drop_legacy_credential_column.sql
-- Hard policy: integration credentials are encrypted via the KMS helper
-- (encrypted_credentials_bytes) or they don't exist. No fallback, no legacy
-- JSON, no exceptions.
--
-- This migration:
--   1. Marks any integration whose credentials live ONLY in the deprecated
--      plaintext `encrypted_credentials` jsonb column as status='disconnected'
--      with a clear last_error so the practice admin reconnects (one-time
--      forced re-encryption).
--   2. Drops the `encrypted_credentials` column outright.
--   3. Adds an `encrypted_credentials_bytes IS NOT NULL` invariant on
--      `connected` integrations so future writes can never bypass the
--      encryption helper.
--
-- The lib/security/credentials.ts helpers (writeCredentials / readCredentials)
-- are now the sole code path for credential I/O.

-- 1. Disconnect any legacy-only integrations (force re-add via OAuth)
update integrations
set
  status = 'disconnected',
  last_error = 'credential_storage_legacy_format_required_reconnect',
  last_synced_at = now()
where status = 'connected'
  and encrypted_credentials_bytes is null;

-- 2. Drop the plaintext column entirely. After this, every reference in
--    application code will fail type-check until rewritten to use the helper.
alter table integrations
  drop column if exists encrypted_credentials;

-- 3. Invariant: any 'connected' integration MUST have encrypted creds.
--    Allows the row to exist in 'disconnected'/'error' states without creds
--    (so we can still record what was configured), but you cannot transition
--    to 'connected' without going through writeCredentials().
alter table integrations
  drop constraint if exists integrations_connected_requires_encrypted_credentials;

alter table integrations
  add constraint integrations_connected_requires_encrypted_credentials
  check (
    status <> 'connected' or encrypted_credentials_bytes is not null
  );

comment on column integrations.encrypted_credentials_bytes is
  'Sole credential storage. Sealed via lib/security/credentials::writeCredentials and the encrypt_credentials_v1 SQL helper. Never write to this column from application code directly — only via the helper. CHECK constraint enforces that any connected integration has a value here.';
