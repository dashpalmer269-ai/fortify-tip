import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { SignupSchema, parseBody } from "@/lib/schemas/api";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * Email signup.
 *
 * Calls supabase.auth.signUp() through the anon-key client, which:
 *   - Creates the user with email_confirmed_at = NULL
 *   - Sends the confirmation email through whatever SMTP is configured
 *     in the Supabase dashboard (we route through Resend)
 *   - Leaves the caller signed-out until they click the link in the email
 *
 * The /auth/callback route handles the click — it exchanges the code for
 * a session and routes the user into onboarding.
 *
 * Server-side wrapper instead of letting the client call signUp() directly
 * so we can rate-limit by client IP (and never trust client-side limits).
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`signup:${clientKey(req)}`, RATE_LIMITS.signup);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(SignupSchema, req);
  if (!parsed.ok) return parsed.response;
  const { email, password, account_type = "admin", invite_code } = parsed.data;

  const supabase = await createAuthedServerClient();
  const origin = req.nextUrl.origin;

  // user_metadata persists across the email-confirm round trip; the URL
  // ?invite=... param does NOT. We stash it here so /api/onboarding/finalize
  // can read it back and redeem the code after the practice is created.
  const userData: Record<string, string> = { account_type };
  if (invite_code && /^[A-Za-z0-9_-]{8,64}$/.test(invite_code)) {
    userData.invite_code = invite_code;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?account_type=${account_type}`,
      data: userData,
    },
  });

  if (error) {
    const status = /registered|exists/i.test(error.message) ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  // Supabase returns user but no session — confirmation pending.
  return NextResponse.json({
    ok: true,
    user_id: data.user?.id ?? null,
    confirmation_required: true,
  });
}
