import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Revoke a pending team invite. Owner/admin of the invite's practice only.
 * The emailed /join link stops working immediately (status flips off
 * 'pending', which every lookup filters on).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inviteId } = await params;

  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: invite } = await db
    .from("practice_invites")
    .select("id, practice_id, email, status")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status !== "pending") {
    return NextResponse.json({ error: `Invite already ${invite.status}` }, { status: 409 });
  }

  const { data: callerMembership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", invite.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !isAdmin(callerMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await requirePracticeAccess(supabase, invite.practice_id);
  if (!guard.ok) return guard.response;

  const { error: upErr } = await db
    .from("practice_invites")
    .update({ status: "revoked" })
    .eq("id", invite.id)
    .eq("status", "pending");
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await db.from("audit_logs").insert({
    practice_id: invite.practice_id,
    actor_user_id: user.id,
    action: "team_invite.revoked",
    resource_type: "practice_invite",
    resource_id: invite.id,
    metadata: { email: invite.email },
  });

  return NextResponse.json({ ok: true });
}
