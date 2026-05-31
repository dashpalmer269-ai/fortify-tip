import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCode, isConfigured } from "@/lib/integrations/microsoft-graph";
import { writeCredentials } from "@/lib/security/credentials";

/**
 * Microsoft 365 OAuth callback.
 *
 * Credentials are sealed via writeCredentials() — the sole encrypted-storage
 * path. The legacy plaintext jsonb column was dropped in migration 028; any
 * write that bypasses the helper is now physically impossible.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.redirect(new URL("/app/integrations?error=not_configured", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateFromQuery = req.nextUrl.searchParams.get("state");
  const stateFromCookie = req.cookies.get("m365_oauth_state")?.value;
  if (!code || !stateFromQuery || stateFromQuery !== stateFromCookie) {
    return NextResponse.redirect(new URL("/app/integrations?error=invalid_state", req.url));
  }

  const practiceId = stateFromQuery.split(":")[0];
  if (!practiceId) {
    return NextResponse.redirect(new URL("/app/integrations?error=invalid_state", req.url));
  }
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const db = createServerClient();
  if (!db) return NextResponse.redirect(new URL("/app/integrations?error=service_unavailable", req.url));

  try {
    const creds = await exchangeCode(code);

    // First insert/update the integration row WITHOUT credentials so the
    // status transitions through a non-'connected' state — the CHECK
    // constraint disallows connected without encrypted_credentials_bytes.
    const { data: integ, error: upErr } = await db
      .from("integrations")
      .upsert(
        {
          practice_id: practiceId,
          integration_type: "microsoft_365",
          status: "disconnected" as const,
          external_account_id: creds.tenant_id,
          display_name: "Microsoft 365",
          scopes: ["User.Read.All", "AuditLog.Read.All", "Reports.Read.All", "DeviceManagementManagedDevices.Read.All"],
          last_synced_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "practice_id,integration_type" }
      )
      .select("id")
      .single();
    if (upErr || !integ) {
      return NextResponse.redirect(
        new URL(`/app/integrations?error=${encodeURIComponent(upErr?.message ?? "upsert_failed")}`, req.url)
      );
    }

    const { error: credErr } = await writeCredentials(db, integ.id, { ...creds });
    if (credErr) {
      return NextResponse.redirect(
        new URL(`/app/integrations?error=${encodeURIComponent("credential_encrypt_failed: " + credErr)}`, req.url)
      );
    }

    // Now flip to connected — the CHECK constraint passes because the
    // encrypted blob is in place.
    await db
      .from("integrations")
      .update({ status: "connected", last_error: null })
      .eq("id", integ.id);

    await db.from("audit_logs").insert({
      practice_id: practiceId,
      actor_user_id: user.id,
      action: "integration.connected",
      resource_type: "integration",
      resource_id: integ.id,
      metadata: { type: "microsoft_365", tenant_id: creds.tenant_id },
    });

    const res = NextResponse.redirect(new URL("/app/integrations?connected=microsoft_365", req.url));
    res.cookies.delete("m365_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/app/integrations?error=${encodeURIComponent((e as Error).message)}`, req.url)
    );
  }
}
