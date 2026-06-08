import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { isAdmin } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Remove a team member from a practice. Admin/owner only.
 * Cannot remove the only owner — there must always be at least one owner.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; target_user_id?: string }
    | null;
  if (!body?.practice_id || !body.target_user_id) {
    return NextResponse.json(
      { error: "practice_id and target_user_id are required" },
      { status: 400 }
    );
  }

  // Caller permission check (the RLS would also block, but explicit message is friendlier)
  const { data: callerMembership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !isAdmin(callerMembership.role)) {
    return NextResponse.json(
      { error: "You must be an admin or owner to remove members." },
      { status: 403 }
    );
  }

  const guard = await requirePracticeAccess(supabase, body.practice_id);
  if (!guard.ok) return guard.response;

  // Look up the target's role + count owners to protect last owner
  const { data: target } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", body.target_user_id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "That user is not a member." }, { status: 404 });
  }
  if (target.role === "owner") {
    const { count } = await supabase
      .from("practice_users")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", body.practice_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the only owner. Transfer ownership first." },
        { status: 400 }
      );
    }
  }

  const { error: delErr } = await supabase
    .from("practice_users")
    .delete()
    .eq("practice_id", body.practice_id)
    .eq("user_id", body.target_user_id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "team.member_removed",
    resource_type: "practice_user",
    resource_id: body.target_user_id,
    metadata: { removed_role: target.role },
  });

  return NextResponse.json({ ok: true });
}
