import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCode, isConfigured } from "@/lib/integrations/google-workspace";
import { writeCredentials } from "@/lib/security/credentials";

/**
 * Google Workspace OAuth callback. Exchanges the code, encrypts the resulting
 * tokens via lib/security/credentials (pgcrypto bytea path), and upserts the
 * integration row.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.redirect(new URL("/app/integrations?error=google_not_configured", req.url));
  }

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const stateFromQuery = url.searchParams.get("state");
  const stateFromCookie = req.cookies.get("google_oauth_state")?.value;

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

    // Upsert the integration row first so we have an id to attach credentials to.
    const { data: integ, error: upErr } = await db
      .from("integrations")
      .upsert(
        {
          practice_id: practiceId,
          integration_type: "google_workspace",
          status: "connected",
          display_name: "Google Workspace",
          scopes: ["admin.directory.user.readonly", "admin.reports.audit.readonly"],
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

    // Encrypt + store the OAuth tokens (requires CREDENTIAL_KMS_KEY).
    const { error: credErr } = await writeCredentials(db, integ.id, {
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
      expires_at: creds.expires_at,
      scope: creds.scope ?? null,
    });
    if (credErr) {
      return NextResponse.redirect(
        new URL(`/app/integrations?error=${encodeURIComponent("credential_encrypt_failed: " + credErr)}`, req.url)
      );
    }

    await db.from("audit_logs").insert({
      practice_id: practiceId,
      actor_user_id: user.id,
      action: "integration.connected",
      resource_type: "integration",
      resource_id: integ.id,
      metadata: { type: "google_workspace" },
    });

    const res = NextResponse.redirect(new URL("/app/integrations?connected=google_workspace", req.url));
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/app/integrations?error=${encodeURIComponent((e as Error).message)}`, req.url)
    );
  }
}
