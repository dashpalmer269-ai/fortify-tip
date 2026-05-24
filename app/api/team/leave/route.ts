import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";

/**
 * Leave a practice. Any role can leave, except the last remaining Owner.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { practice_id?: string } | null;
  if (!body?.practice_id) {
    return NextResponse.json({ error: "practice_id required" }, { status: 400 });
  }

  // Get caller's membership
  const { data: membership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this practice." }, { status: 404 });
  }

  // Protect last owner
  if (membership.role === "owner") {
    const { count } = await supabase
      .from("practice_users")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", body.practice_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error:
            "You are the only Owner. Transfer ownership to another member, or delete the practice instead.",
        },
        { status: 400 }
      );
    }
  }

  const { error: delErr } = await supabase
    .from("practice_users")
    .delete()
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "team.member_left",
    resource_type: "practice_user",
    resource_id: user.id,
    metadata: { left_role: membership.role },
  });

  return NextResponse.json({ ok: true });
}
