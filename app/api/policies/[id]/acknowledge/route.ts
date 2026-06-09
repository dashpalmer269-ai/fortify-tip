import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Record a workforce member's acknowledgment of a policy at its current
 * version. Idempotent — re-acknowledging the same version returns the
 * existing row's id without inserting again. Auto-resolves the matching
 * policy_ack remediation task on the punch list.
 *
 * Implementation: delegates to the acknowledge_policy() SECURITY DEFINER
 * RPC (migration 044) so the entire flow — version load, idempotency
 * check, ack insert, task auto-resolve, audit_log — runs in one
 * transaction with the policies row locked. Previously this route
 * issued 4 separate service-role writes; now it issues 1 RPC call
 * (plus the access-gate lookup) and the service-role surface shrinks
 * accordingly.
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

  // SECURITY DEFINER RPC — verifies membership again inside the function,
  // runs the whole acknowledgment + auto-resolve in one transaction.
  // Call via authed client so the function executes with the caller's
  // identity context (auth.uid()) even though it's marked DEFINER.
  const { data, error } = await supabase.rpc("acknowledge_policy", {
    p_policy_id: policyId,
    p_user_id: session.user.id,
  });

  if (error) {
    // The RPC raises with P0001 for not-found / not-active, 28000 for
    // missing membership. Map back to HTTP codes the client expects.
    if (/Policy not found/i.test(error.message)) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    if (/Only active policies/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (/No membership/i.test(error.message) || error.code === "28000") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    acknowledgment_id: string;
    resolved_task_id: string | null;
    already_acknowledged: boolean;
  } | null;

  return NextResponse.json({
    ok: true,
    already_acknowledged: row?.already_acknowledged ?? false,
    acknowledgment_id: row?.acknowledgment_id ?? null,
    resolved_task_id: row?.resolved_task_id ?? null,
  });
}
