import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { isAdmin, isOwner, type Role } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Change a member's role.
 *  - Admin can promote/demote staff <-> compliance_officer <-> admin.
 *  - Only an Owner can grant or revoke the Owner role.
 *  - Cannot demote the last remaining Owner.
 */
const VALID_ROLES: Role[] = ["owner", "admin", "compliance_officer", "staff", "auditor_readonly"];

export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; target_user_id?: string; new_role?: Role }
    | null;
  if (!body?.practice_id || !body.target_user_id || !body.new_role) {
    return NextResponse.json(
      { error: "practice_id, target_user_id, and new_role are required" },
      { status: 400 }
    );
  }
  if (!VALID_ROLES.includes(body.new_role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Caller permission
  const { data: callerMembership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !isAdmin(callerMembership.role)) {
    return NextResponse.json({ error: "Admin or owner permission required." }, { status: 403 });
  }

  const guard = await requirePracticeAccess(supabase, body.practice_id);
  if (!guard.ok) return guard.response;

  // Granting or revoking Owner requires the caller themselves to be Owner
  const { data: target } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", body.target_user_id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const involvesOwner = target.role === "owner" || body.new_role === "owner";
  if (involvesOwner && !isOwner(callerMembership.role)) {
    return NextResponse.json(
      { error: "Only an Owner can grant or revoke the Owner role." },
      { status: 403 }
    );
  }

  // Cannot demote the last Owner
  if (target.role === "owner" && body.new_role !== "owner") {
    const { count } = await supabase
      .from("practice_users")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", body.practice_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the only Owner. Promote someone else to Owner first." },
        { status: 400 }
      );
    }
  }

  const { error: updErr } = await supabase
    .from("practice_users")
    .update({ role: body.new_role })
    .eq("practice_id", body.practice_id)
    .eq("user_id", body.target_user_id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "team.role_changed",
    resource_type: "practice_user",
    resource_id: body.target_user_id,
    metadata: { from_role: target.role, to_role: body.new_role },
  });

  return NextResponse.json({ ok: true });
}
