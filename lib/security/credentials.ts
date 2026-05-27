/**
 * Integration credential encryption helpers.
 *
 * Reads/writes integrations.encrypted_credentials_bytes via the pgcrypto
 * helpers added in migration 015. The symmetric key lives in the
 * CREDENTIAL_KMS_KEY env var — never in the database.
 *
 * Usage:
 *   import { writeCredentials, readCredentials } from "@/lib/security/credentials";
 *   await writeCredentials(db, integrationId, { access_token, refresh_token, ... });
 *   const creds = await readCredentials(db, integrationId);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

function getKey(): string {
  const k = process.env.CREDENTIAL_KMS_KEY;
  if (!k || k.length < 32) {
    throw new Error(
      "CREDENTIAL_KMS_KEY must be set to a strong (>=32 char) secret before reading or writing integration credentials"
    );
  }
  return k;
}

/**
 * Encrypts the JSON payload via the SQL helper and writes it to the
 * integrations row. Service-role only (RLS will reject otherwise).
 */
export async function writeCredentials(
  db: Db,
  integrationId: string,
  payload: Record<string, unknown>
): Promise<{ error: string | null }> {
  const key = getKey();
  const plaintext = JSON.stringify(payload);

  // Encrypt server-side via the SQL helper, capture the returned bytea
  const { data: encrypted, error: encErr } = await db.rpc("encrypt_credentials_v1", {
    plaintext,
    key,
  });
  if (encErr) return { error: encErr.message };

  const { error: updErr } = await db
    .from("integrations")
    .update({ encrypted_credentials_bytes: encrypted as unknown as string })
    .eq("id", integrationId);
  if (updErr) return { error: updErr.message };
  return { error: null };
}

/**
 * Reads + decrypts the credentials blob for an integration row. Returns null
 * if the row doesn't exist, has no encrypted blob, or decryption fails (wrong
 * key, corrupted blob).
 */
export async function readCredentials<T = Record<string, unknown>>(
  db: Db,
  integrationId: string
): Promise<T | null> {
  const key = getKey();

  const { data: row, error } = await db
    .from("integrations")
    .select("encrypted_credentials_bytes")
    .eq("id", integrationId)
    .maybeSingle();
  if (error || !row?.encrypted_credentials_bytes) return null;

  const { data: plaintext, error: decErr } = await db.rpc("decrypt_credentials_v1", {
    cipher: row.encrypted_credentials_bytes as unknown as string,
    key,
  });
  if (decErr || typeof plaintext !== "string") return null;

  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}
