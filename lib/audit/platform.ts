/**
 * Durable platform-level audit log.
 *
 * Writes to `platform_audit_logs` — a table that does NOT cascade with
 * `practices`, so the record survives tenant deletion. Use for events
 * whose forensic value must outlive the tenant: practice deletion,
 * invite create/revoke, billing state changes from Stripe webhooks,
 * future platform-admin actions (impersonation, manual data exports,
 * etc.).
 *
 * Differs from `audit_logs`:
 *   • audit_logs is per-tenant, cascade-deletes with the practice
 *   • platform_audit_logs is operator-facing, never deleted by tenant
 *     activity, hidden from authenticated reads (RLS denies all)
 *   • the helper accepts an optional Supabase service-role client; if
 *     the database isn't available the write is best-effort and the
 *     event is also mirrored to Sentry as a breadcrumb so we don't
 *     silently drop forensic data
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type { Database } from "@/lib/supabase/database.types";
import { scanForPhi } from "@/lib/compliance/phi-scanner";

export type PlatformAuditEvent =
  | "practice.deleted"
  | "invite.created"
  | "invite.revoked"
  | "billing.subscription_started"
  | "billing.subscription_changed"
  | "billing.subscription_canceled"
  | "billing.invoice_failed"
  | "platform.impersonation_started"
  | "platform.impersonation_ended"
  | "platform.manual_data_export";

export interface PlatformAuditPayload {
  event: PlatformAuditEvent;
  practice_id?: string | null;
  practice_name?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Defense-in-depth PHI scrub for platform-audit payloads. Platform events
 * are constructed by us from identifiers + amounts — never user free-text —
 * so PHI exposure should be impossible by design. This scrub is a belt: any
 * string value that trips the PHI scanner is replaced with "[redacted-phi]"
 * before the row is written. Keeps the durable, externally-retained audit
 * log PHI-safe even if a future caller passes something it shouldn't.
 */
function scrubPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string") {
      out[k] = scanForPhi(v).clean ? v : "[redacted-phi]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function logPlatformEvent(
  db: SupabaseClient<Database> | null,
  evt: PlatformAuditPayload
): Promise<void> {
  const safePayload = scrubPayload(evt.payload ?? {});

  // Mirror to Sentry FIRST so even a DB failure leaves an external trail.
  Sentry.addBreadcrumb({
    category: "platform-audit",
    level: "info",
    message: evt.event,
    data: {
      practice_id: evt.practice_id,
      actor_user_id: evt.actor_user_id,
      actor_role: evt.actor_role,
    },
  });

  if (!db) return;

  try {
    await db.from("platform_audit_logs").insert({
      event: evt.event,
      practice_id: evt.practice_id ?? null,
      practice_name: evt.practice_name ?? null,
      actor_user_id: evt.actor_user_id ?? null,
      actor_email: evt.actor_email ?? null,
      actor_role: evt.actor_role ?? null,
      // The Json type from database.types.ts is strict about nested
      // structure; the helper accepts any Record<string, unknown> from
      // callers. Cast at the boundary — Supabase serializes via
      // JSON.stringify so structurally any JSON-safe value is fine.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: safePayload as any,
    });
  } catch (err) {
    // Last-resort surfacing: capture as a Sentry exception so the audit
    // failure itself is investigable.
    Sentry.captureException(err, {
      tags: { event: "platform_audit_write_failed", original_event: evt.event },
    });
  }
}
