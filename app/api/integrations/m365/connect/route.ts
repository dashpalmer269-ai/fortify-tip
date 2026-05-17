import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { authorizationUrl, isConfigured } from "@/lib/integrations/microsoft-graph";

/**
 * Begin Microsoft 365 OAuth. Stores a short-lived state token in the session
 * cookie set so the callback can verify request origin.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error: "Microsoft 365 OAuth not configured",
        next_step: "Set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI in Vercel.",
      },
      { status: 503 }
    );
  }

  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // State = practice_id + random nonce; callback uses it to know which practice
  // to attach the credentials to.
  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice membership" }, { status: 400 });

  const nonce = crypto.randomUUID();
  const state = `${membership.practice_id}:${nonce}`;
  const url = authorizationUrl(state);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set("m365_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
