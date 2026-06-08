import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { authorizationUrl, isConfigured } from "@/lib/integrations/google-workspace";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Begin Google Workspace OAuth. Stores a short-lived state token in a cookie
 * so the callback can verify origin and resolve the practice.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error: "Google Workspace OAuth not configured",
        next_step: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in Vercel.",
      },
      { status: 503 }
    );
  }

  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice membership" }, { status: 400 });
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only admins can connect integrations" }, { status: 403 });
  }

  const guard = await requirePracticeAccess(supabase, membership.practice_id);
  if (!guard.ok) return guard.response;

  const nonce = crypto.randomUUID();
  const state = `${membership.practice_id}:${nonce}`;
  const url = authorizationUrl(state);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
