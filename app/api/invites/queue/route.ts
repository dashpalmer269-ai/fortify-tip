import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Stub for the invite queue. Real implementation persists pending invites
 * to a practice_invites table and the email worker picks them up.
 *
 * In the MVP build before email is wired we accept the request and return OK
 * so the onboarding UI moves forward cleanly. Phase E replaces this body.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | { practice_id?: string; invites?: Array<{ email: string; role: string }> }
    | null;
  if (!body?.practice_id || !Array.isArray(body.invites)) {
    return NextResponse.json({ error: "practice_id and invites[] required" }, { status: 400 });
  }

  const guard = await requirePracticeAccess(supabase, body.practice_id);
  if (!guard.ok) return guard.response;

  // Audit log so the action is visible even before email goes out.
  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "invites.queued",
    resource_type: "practice_invites",
    resource_id: null,
    metadata: { count: body.invites.length, invites: body.invites },
  });

  return NextResponse.json({ ok: true, queued: body.invites.length });
}
