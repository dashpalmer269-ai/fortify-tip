import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Update a team member's display name (user_profiles.full_name).
 *
 * Body: { practice_id, target_user_id, full_name }
 *
 * Caller must be an owner/admin of the same practice as the target.
 * Upserts user_profiles so admins (who may not have a profile row yet) get
 * one created with their name.
 *
 * DEMO WORKAROUND: writes via service-role to bypass the RLS auth.uid()
 * issue. Caller's admin status is verified explicitly.
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; target_user_id?: string; full_name?: string }
    | null;
  const fullName = (body?.full_name ?? "").trim();
  if (!body?.practice_id || !body.target_user_id || !fullName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (fullName.length > 120) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  // Caller must be admin of the practice
  const { data: callerMembership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Target must be in the same practice
  const { data: targetMembership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", body.target_user_id)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: "Target not in this practice" }, { status: 404 });
  }

  // Upsert user_profiles. Account type defaults to 'admin' for users without a profile
  // (most admins won't have one yet); for standards this preserves their existing row.
  const { data: existing } = await db
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", body.target_user_id)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("user_profiles")
      .update({ full_name: fullName })
      .eq("user_id", body.target_user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("user_profiles").insert({
      user_id: body.target_user_id,
      account_type: "admin", // best-guess default; doesn't affect onboarding routing for existing members
      full_name: fullName,
      status: "approved",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit
  await db.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "team.name_updated",
    resource_type: "user_profile",
    resource_id: body.target_user_id,
    metadata: { new_name: fullName },
  });

  return NextResponse.json({ ok: true });
}
