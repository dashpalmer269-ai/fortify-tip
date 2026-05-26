import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { isAdmin, isAssignableRole, type Role } from "@/lib/auth/permissions";

/**
 * Add an existing Supabase Auth user to the current practice by email.
 * Service-role required because auth.users isn't readable to anon/authenticated.
 * Caller must be owner/admin of the target practice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; email?: string; role?: Role }
    | null;
  if (!body?.practice_id || !body.email || !body.role) {
    return NextResponse.json(
      { error: "practice_id, email, and role are required" },
      { status: 400 }
    );
  }
  if (!isAssignableRole(body.role)) {
    return NextResponse.json({ error: "Role cannot be assigned (use Owner-only path)" }, { status: 400 });
  }

  // Verify caller is admin of the target practice
  const { data: callerMembership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !isAdmin(callerMembership.role)) {
    return NextResponse.json(
      { error: "You must be an admin or owner of this practice to add members." },
      { status: 403 }
    );
  }

  // Find the target user via the admin API (needs service role)
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Server-side Supabase not configured" }, { status: 503 });
  }
  // Supabase doesn't have a direct "find user by email" — we use admin.listUsers
  // and filter. For low-N teams this is fine; at scale we'd page or maintain
  // an email→id index.
  const lower = body.email.trim().toLowerCase();
  const { data: list, error: listErr } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Lookup failed: ${listErr.message}` }, { status: 500 });
  }
  const target = (list?.users ?? []).find((u) => u.email?.toLowerCase() === lower);
  if (!target) {
    return NextResponse.json(
      {
        error:
          "No account found for that email. Have the person sign up first, then add them.",
        signup_required: true,
      },
      { status: 404 }
    );
  }

  // Prevent duplicate membership
  const { data: existing } = await supabase
    .from("practice_users")
    .select("id")
    .eq("practice_id", body.practice_id)
    .eq("user_id", target.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "User is already a member of this practice." }, { status: 409 });
  }

  const { error: insErr } = await supabase.from("practice_users").insert({
    practice_id: body.practice_id,
    user_id: target.id,
    role: body.role,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "team.member_added",
    resource_type: "practice_user",
    resource_id: target.id,
    metadata: { added_email: lower, role: body.role },
  });

  return NextResponse.json({ ok: true, user_id: target.id });
}
