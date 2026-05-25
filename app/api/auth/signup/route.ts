import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Demo signup: creates an auto-confirmed user via service-role so we skip the
 * Supabase email-confirmation flow (which is rate-limited to 4/hour on free
 * tier and was blocking demos). The client then signs in normally to get a
 * cookie-based session.
 *
 * Pairs with the /api/onboarding/finalize RLS bypass — these are demo-only;
 * post-beta, restore the standard signUp() + email-confirm flow once SMTP is
 * wired through Resend.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; account_type?: "admin" | "employee" }
    | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  const accountType = body.account_type === "employee" ? "employee" : "admin";

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await db.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { account_type: accountType },
  });

  if (error) {
    const status = /registered|exists/i.test(error.message) ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id ?? null });
}
