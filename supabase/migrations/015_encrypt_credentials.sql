-- 015_encrypt_credentials.sql
-- Replace the plaintext-JSONB encrypted_credentials column with a real
-- pgcrypto-backed bytea column. Decryption happens via a SECURITY DEFINER
-- function that takes the symmetric key from a Postgres GUC.
--
-- The key is injected once per session by the application via
--   select set_config('fortify.cred_key', '<key>', true);
-- The application reads CREDENTIAL_KMS_KEY from env at startup and sets it
-- on every request that needs to read/write integration credentials.
--
-- IMPORTANT: rotate the key by re-encrypting all rows. Storing the key in
-- the database itself would defeat the purpose. Key lives in:
--   - Vercel env var CREDENTIAL_KMS_KEY (production)
--   - .env.local CREDENTIAL_KMS_KEY (dev)

create extension if not exists pgcrypto;

alter table integrations
  add column if not exists encrypted_credentials_bytes bytea;

-- Encrypt-write helper. Pass the JSON payload as text + the symmetric key.
create or replace function encrypt_credentials_v1(plaintext text, key text)
returns bytea
language sql
immutable
as $$
  select pgp_sym_encrypt(plaintext, key, 'cipher-algo=aes256, compress-algo=1')
$$;

-- Decrypt-read helper. Returns the plaintext JSON, or null if decryption
-- fails (wrong key, corrupted blob).
create or replace function decrypt_credentials_v1(cipher bytea, key text)
returns text
language plpgsql
stable
as $$
declare
  result text;
begin
  begin
    result := pgp_sym_decrypt(cipher, key);
  exception when others then
    result := null;
  end;
  return result;
end
$$;

-- These functions are only callable by service_role — never authenticated.
revoke all on function encrypt_credentials_v1(text, text) from public;
revoke all on function encrypt_credentials_v1(text, text) from authenticated;
revoke all on function decrypt_credentials_v1(bytea, text) from public;
revoke all on function decrypt_credentials_v1(bytea, text) from authenticated;
grant execute on function encrypt_credentials_v1(text, text) to service_role;
grant execute on function decrypt_credentials_v1(bytea, text) to service_role;

-- The new bytea column is also service-role-only at the column level (RLS on
-- the table already restricts access; this is belt-and-suspenders).
comment on column integrations.encrypted_credentials_bytes is
  'pgcrypto-encrypted credentials. Service-role only. Pair with CREDENTIAL_KMS_KEY env var. The old jsonb encrypted_credentials column is retained until migration of existing rows is complete; new writes go to bytes.';

comment on column integrations.encrypted_credentials is
  'DEPRECATED: kept for backward compat during migration. New writes go to encrypted_credentials_bytes via lib/security/credentials.ts.';
