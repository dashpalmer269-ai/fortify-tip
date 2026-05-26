import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { exchangeCode, isConfigured } from "@/lib/integrations/microsoft-graph";
import type { Json } from "@/lib/supabase/database.types";

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
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const creds = await exchangeCode(code);
    await supabase.from("integrations").upsert(
      {
        practice_id: practiceId,
        integration_type: "microsoft_365",
        status: "connected",
        external_account_id: creds.tenant_id,
        display_name: "Microsoft 365",
        scopes: ["User.Read.All", "AuditLog.Read.All", "Reports.Read.All", "DeviceManagementManagedDevices.Read.All"],
        encrypted_credentials: creds as unknown as Json,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "practice_id,integration_type" }
    );
    await supabase.from("audit_logs").insert({
      practice_id: practiceId,
      actor_user_id: user.id,
      action: "integration.connected",
      resource_type: "integration",
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
