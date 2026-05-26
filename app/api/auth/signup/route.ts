import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { SignupSchema, parseBody } from "@/lib/schemas/api";

/**
 * Demo signup: creates an auto-confirmed user via service-role so we skip
 * the Supabase email-confirmation flow (rate-limited to 4/hour on free
 * tier and was blocking demos). The client signs in normally afterward to
 * establish a cookie-based session.
 *
 * Pairs with the /api/onboarding/finalize RLS bypass — these are demo-only.
 * Post-beta, restore the standard signUp() + email-confirm flow once SMTP
 * is wired through Resend.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(SignupSchema, req);
  if (!parsed.ok) return parsed.response;
  const { email, password, account_type = "admin" } = parsed.data;

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type },
  });

  if (error) {
    const status = /registered|exists/i.test(error.message) ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id ?? null });
}
