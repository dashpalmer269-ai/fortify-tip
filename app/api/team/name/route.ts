import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { TeamRenameSchema, parseBody } from "@/lib/schemas/api";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Update a team member's display name (user_profiles.full_name).
 *
 * Service-role usage justification:
 *   Admin is updating ANOTHER user's profile (target_user_id !== caller).
 *   The user_profiles RLS policy is "user_id = auth.uid()" — i.e. users
 *   may only modify their OWN profile. Admin-managing-other-users
 *   requires service-role, which is the correct pattern for this kind
 *   of administrative operation.
 *
 * Safety invariants verified in this handler:
 *   - user.id from authenticated JWT, not body
 *   - Caller's owner/admin membership verified against the same practice
 *     before any write
 *   - Target's membership in the same practice verified before update
 *   - audit_log entry pins actor_user_id = auth.uid()
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(TeamRenameSchema, req, { phiFields: ["full_name"] });
  if (!parsed.ok) return parsed.response;
  const { practice_id, target_user_id, full_name } = parsed.data;

  // Caller must be admin of the practice
  const { data: callerMembership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await requirePracticeAccess(db, practice_id);
  if (!guard.ok) return guard.response;

  // Target must be in the same practice
  const { data: targetMembership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", practice_id)
    .eq("user_id", target_user_id)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: "Target not in this practice" }, { status: 404 });
  }

  const { data: existing } = await db
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", target_user_id)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("user_profiles")
      .update({ full_name })
      .eq("user_id", target_user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("user_profiles").insert({
      user_id: target_user_id,
      account_type: "admin",
      full_name,
      status: "approved",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    practice_id,
    actor_user_id: user.id,
    action: "team.name_updated",
    resource_type: "user_profile",
    resource_id: target_user_id,
    metadata: { new_name: full_name },
  });

  return NextResponse.json({ ok: true });
}
