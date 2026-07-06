import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { isAdmin } from "@/lib/auth/permissions";

// Mirrors the integrations.integration_type CHECK constraint — the compile
// error on the .eq() below is the tripwire if the DB union ever widens.
const INTEGRATION_TYPES = [
  "microsoft_365", "google_workspace", "okta", "azure_ad",
  "aws", "gcp", "azure",
  "datto", "acronis", "cove_nable", "veeam", "azure_backup",
  "athenahealth", "advancedmd", "dentrix", "kareo_tebra", "drchrono", "ehr_other",
  "ninjaone", "connectwise", "connectwise_rmm", "connectwise_automate",
  "datto_rmm", "atera", "syncro", "nable_rmm",
  "docusign", "dropbox_sign",
  "jira", "linear", "asana", "trello",
] as const;

const DisconnectSchema = z.object({
  integration_type: z.enum(INTEGRATION_TYPES),
});

/**
 * Disconnect an integration: wipe the sealed credentials and flip status.
 *
 * Admin-gated, but intentionally NOT behind requirePracticeAccess — a
 * customer must always be able to revoke Fortify's access to their systems,
 * demo expired or not (same class of always-allowed as /api/team/leave).
 *
 * Service-role write because the credentials CHECK constraint (migration
 * 028: connected ⇒ bytes present) makes the credential column a
 * service-role-only surface by design.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(DisconnectSchema, req);
  if (!parsed.ok) return parsed.response;

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice" }, { status: 403 });
  if (!isAdmin(membership.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can disconnect an integration." },
      { status: 403 }
    );
  }

  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: integ } = await db
    .from("integrations")
    .select("id, integration_type, status, external_account_id")
    .eq("practice_id", membership.practice_id)
    .eq("integration_type", parsed.data.integration_type)
    .maybeSingle();
  if (!integ) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  if (integ.status === "disconnected") {
    return NextResponse.json({ error: "Already disconnected" }, { status: 409 });
  }

  const { error: upErr } = await db
    .from("integrations")
    .update({
      status: "disconnected",
      encrypted_credentials_bytes: null,
      scopes: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integ.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await db.from("audit_logs").insert({
    practice_id: membership.practice_id,
    actor_user_id: user.id,
    action: "integration.disconnected",
    resource_type: "integration",
    resource_id: integ.id,
    metadata: {
      integration_type: integ.integration_type,
      external_account_id: integ.external_account_id,
    },
  });

  return NextResponse.json({ ok: true });
}
