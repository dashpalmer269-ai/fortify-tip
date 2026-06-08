import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth/permissions";
import { logPlatformEvent } from "@/lib/audit/platform";

/**
 * Permanently delete a practice and ALL its data.
 * Owner only. Requires confirmation via the `confirm_name` field matching
 * the practice's name (case-insensitive). All tenant data cascades via
 * the foreign keys in the schema.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; confirm_name?: string }
    | null;
  if (!body?.practice_id || !body.confirm_name) {
    return NextResponse.json(
      { error: "practice_id and confirm_name are required" },
      { status: 400 }
    );
  }

  // Verify caller is owner
  const { data: membership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !isOwner(membership.role)) {
    return NextResponse.json({ error: "Only the practice Owner can delete it." }, { status: 403 });
  }

  // Verify the confirmation name matches
  const { data: practice } = await supabase
    .from("practices")
    .select("name")
    .eq("id", body.practice_id)
    .maybeSingle();
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }
  if (practice.name.trim().toLowerCase() !== body.confirm_name.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Confirmation does not match the practice name." },
      { status: 400 }
    );
  }

  // Durable platform audit row BEFORE the cascade. The per-tenant
  // audit_logs row would be deleted along with the practice (foreign-key
  // cascade), so the canonical forensic record lives in
  // platform_audit_logs (no practice FK; survives tenant deletion).
  // logPlatformEvent also mirrors the event to Sentry as a breadcrumb.
  const platformDb = createServerClient();
  await logPlatformEvent(platformDb, {
    event: "practice.deleted",
    practice_id: body.practice_id,
    practice_name: practice.name,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    actor_role: "owner",
    payload: { confirm_name: body.confirm_name },
  });

  // Cascade delete
  const { error: delErr } = await supabase
    .from("practices")
    .delete()
    .eq("id", body.practice_id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
