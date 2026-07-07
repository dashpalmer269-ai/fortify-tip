import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { isOfficer } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Activate a draft policy so the workforce can acknowledge it.
 *
 * Without this transition the entire policy-acknowledgment loop was
 * unreachable: /api/policies/generate creates status='draft', the
 * acknowledge RPC only accepts 'active', and nothing flipped the status.
 *
 * Officer-gated (owner/admin/compliance_officer). Sets effective_date to
 * today and next_review_date one year out — the annual-review convention
 * the readiness rules expect.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice" }, { status: 403 });
  if (!isOfficer(membership.role)) {
    return NextResponse.json(
      { error: "Only an owner, admin, or compliance officer can activate policies." },
      { status: 403 }
    );
  }

  const guard = await requirePracticeAccess(supabase, membership.practice_id);
  if (!guard.ok) return guard.response;

  const { data: policy } = await supabase
    .from("policies")
    .select("id, title, status, version")
    .eq("id", id)
    .eq("practice_id", membership.practice_id)
    .maybeSingle();
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  if (policy.status === "active") {
    return NextResponse.json({ error: "Policy is already active" }, { status: 409 });
  }
  if (policy.status === "archived") {
    return NextResponse.json({ error: "Archived policies cannot be activated" }, { status: 409 });
  }

  const today = new Date();
  const nextReview = new Date(today);
  nextReview.setFullYear(nextReview.getFullYear() + 1);

  const { error: upErr } = await supabase
    .from("policies")
    .update({
      status: "active",
      effective_date: today.toISOString().slice(0, 10),
      next_review_date: nextReview.toISOString().slice(0, 10),
      updated_at: today.toISOString(),
    })
    .eq("id", policy.id)
    .eq("practice_id", membership.practice_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    practice_id: membership.practice_id,
    actor_user_id: user.id,
    action: "policy.activated",
    resource_type: "policy",
    resource_id: policy.id,
    metadata: { title: policy.title, version: policy.version ?? 1 },
  });

  return NextResponse.json({ ok: true, status: "active" });
}
