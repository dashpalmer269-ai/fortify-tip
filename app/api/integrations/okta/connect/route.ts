import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { OktaConnectSchema } from "@/lib/schemas/integrations";
import { validateConnection } from "@/lib/integrations/okta";
import { writeCredentials } from "@/lib/security/credentials";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * Connect Okta via org URL + API token (SSWS).
 *
 * Validates the token against the org before persisting, then encrypts and
 * stores it. Admin/owner only.
 */
export async function POST(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(OktaConnectSchema, req);
  if (!parsed.ok) return parsed.response;
  const { org_url, api_token } = parsed.data;

  const { data: membership } = await db
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice membership" }, { status: 400 });
  if (!isAdmin(membership.role)) {
    return NextResponse.json({ error: "Only admins can connect integrations" }, { status: 403 });
  }

  // Validate the credentials before persisting.
  const check = await validateConnection({ org_url, api_token });
  if (!check.ok) {
    return NextResponse.json({ error: `Okta connection failed: ${check.error}` }, { status: 400 });
  }

  const { data: integ, error: upErr } = await db
    .from("integrations")
    .upsert(
      {
        practice_id: membership.practice_id,
        integration_type: "okta",
        status: "connected",
        display_name: "Okta",
        external_account_id: new URL(org_url).hostname,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "practice_id,integration_type" }
    )
    .select("id")
    .single();
  if (upErr || !integ) {
    return NextResponse.json({ error: upErr?.message ?? "upsert failed" }, { status: 500 });
  }

  const { error: credErr } = await writeCredentials(db, integ.id, { org_url, api_token });
  if (credErr) {
    return NextResponse.json({ error: `credential_encrypt_failed: ${credErr}` }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    practice_id: membership.practice_id,
    actor_user_id: user.id,
    action: "integration.connected",
    resource_type: "integration",
    resource_id: integ.id,
    metadata: { type: "okta", org: new URL(org_url).hostname },
  });

  return NextResponse.json({ ok: true, integration_id: integ.id });
}
