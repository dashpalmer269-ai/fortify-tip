import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

/**
 * Record the calling user's completion of a training module. Idempotent
 * with respect to (module_id, user_id, completed_at). Sets expires_on
 * one year from completion so the verify-compliance cron can detect
 * lapsed training without a separate cadence calculation.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (session.kind !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: moduleId } = await params;

  const supabase = await createAuthedServerClient();
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Verify the module exists and is active
  const { data: module } = await supabase
    .from("training_modules")
    .select("id, title, active, passing_score, module_type")
    .eq("id", moduleId)
    .maybeSingle();
  if (!module) return NextResponse.json({ error: "Module not found" }, { status: 404 });
  if (!module.active) {
    return NextResponse.json({ error: "Module is not active" }, { status: 400 });
  }

  const now = new Date();
  const expiresOn = new Date(now.getTime() + 365 * 86400_000);

  // Insert completion (RLS scopes to practice membership)
  const { data: completion, error: insErr } = await supabase
    .from("training_completions")
    .insert({
      module_id: moduleId,
      practice_id: session.membership.practice_id,
      user_id: session.user.id,
      score: module.passing_score ?? 100,
      expires_on: expiresOn.toISOString().slice(0, 10),
    })
    .select("id, completed_at, expires_on")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Audit log
  await db.from("audit_logs").insert({
    practice_id: session.membership.practice_id,
    actor_user_id: session.user.id,
    action: "training.completed",
    resource_type: "training_module",
    resource_id: moduleId,
    metadata: { module_title: module.title, module_type: module.module_type },
  });

  return NextResponse.json({
    ok: true,
    completion_id: completion.id,
    completed_at: completion.completed_at,
    expires_on: completion.expires_on,
  });
}
