import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Record a workforce member's acknowledgment of a policy at its current
 * version. Idempotent — re-acknowledging the same version returns the
 * existing row's timestamp without inserting again. Auto-resolves the
 * corresponding policy_ack remediation task on the punch list.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (session.kind !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: policyId } = await params;

  const supabase = await createAuthedServerClient();
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const guard = await requirePracticeAccess(db, session.membership.practice_id);
  if (!guard.ok) return guard.response;

  // Load the policy + verify it belongs to the practice
  const { data: policy } = await supabase
    .from("policies")
    .select("id, practice_id, version, status, title")
    .eq("id", policyId)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  if (policy.status !== "active") {
    return NextResponse.json(
      { error: "Only active policies can be acknowledged" },
      { status: 400 }
    );
  }

  const version = policy.version ?? 1;

  // Already acknowledged this version?
  const { data: existing } = await supabase
    .from("policy_acknowledgments")
    .select("acknowledged_at")
    .eq("policy_id", policyId)
    .eq("user_id", session.user.id)
    .eq("policy_version", version)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      already_acknowledged: true,
      acknowledged_at: existing.acknowledged_at,
    });
  }

  // Insert the acknowledgment
  const { data: ack, error: insErr } = await supabase
    .from("policy_acknowledgments")
    .insert({
      policy_id: policyId,
      practice_id: session.membership.practice_id,
      user_id: session.user.id,
      policy_version: version,
    })
    .select("acknowledged_at")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Auto-resolve the matching policy_ack remediation task. Tasks created
  // by the task generator have subject_ref = policy_id, assigned_to = user.
  // Service-role required because the task may not be owned by the caller
  // for assignee-update RLS (the task IS assigned to the caller, but
  // batch-marking done across multiple rows is cleaner via service-role).
  await db
    .from("remediation_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: session.user.id,
    })
    .eq("practice_id", session.membership.practice_id)
    .eq("source", "policy_ack")
    .eq("subject_ref", policyId)
    .eq("assigned_to", session.user.id)
    .in("status", ["open", "in_progress", "blocked"]);

  // Audit log
  await db.from("audit_logs").insert({
    practice_id: session.membership.practice_id,
    actor_user_id: session.user.id,
    action: "policy.acknowledged",
    resource_type: "policy",
    resource_id: policyId,
    metadata: { policy_title: policy.title, version },
  });

  return NextResponse.json({
    ok: true,
    already_acknowledged: false,
    acknowledged_at: ack.acknowledged_at,
  });
}
