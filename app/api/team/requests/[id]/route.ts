import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { RequestDecisionSchema, parseBody } from "@/lib/schemas/api";
import { sendEmail } from "@/lib/email/provider";
import { joinRequestApprovedEmail, joinRequestDeniedEmail } from "@/lib/email/templates";
import { ROLE_LABELS } from "@/lib/auth/permissions";

/**
 * Approve or deny a pending Standard-user request.
 *
 * URL: /api/team/requests/[id]   ([id] = the requesting user_id)
 * Body: discriminated union — { action: 'approve', role? } | { action: 'deny', denial_reason? }
 *
 * The caller must be an owner/admin of the practice the request was matched to.
 * On approve we create the practice_users row (default role: staff) and flip
 * status to 'approved'. On deny we flip status to 'denied' with reason.
 * Either way we notify the requesting user and write an audit log entry.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestUserId } = await params;

  const userClient = await createAuthedServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(RequestDecisionSchema, req, {
    phiFields: ["denial_reason"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Load the request
  const { data: profile, error: pErr } = await db
    .from("user_profiles")
    .select("user_id, full_name, matched_practice_id, status, account_type")
    .eq("user_id", requestUserId)
    .maybeSingle();
  if (pErr || !profile) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (profile.account_type !== "employee") {
    return NextResponse.json({ error: "Not a standard-user request" }, { status: 400 });
  }
  if (profile.status !== "pending") {
    return NextResponse.json({ error: `Request already ${profile.status}` }, { status: 409 });
  }
  if (!profile.matched_practice_id) {
    return NextResponse.json({ error: "Request not matched to a practice" }, { status: 400 });
  }

  // Verify the caller is an admin of that practice
  const { data: callerMembership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", profile.matched_practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  if (body.action === "approve") {
    const role = body.role ?? "staff";

    const { error: muErr } = await db.from("practice_users").upsert(
      { practice_id: profile.matched_practice_id, user_id: profile.user_id, role },
      { onConflict: "practice_id,user_id" }
    );
    if (muErr) return NextResponse.json({ error: muErr.message }, { status: 500 });

    const { error: upErr } = await db
      .from("user_profiles")
      .update({
        status: "approved",
        decided_by: user.id,
        decided_at: now,
        denial_reason: null,
      })
      .eq("user_id", profile.user_id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await db.from("notifications").insert({
      user_id: profile.user_id,
      practice_id: profile.matched_practice_id,
      kind: "request.approved",
      title: "You're in",
      body: "Your request to join the workspace was approved.",
      link: "/app",
    });

    await db.from("audit_logs").insert({
      practice_id: profile.matched_practice_id,
      actor_user_id: user.id,
      action: "request.approved",
      resource_type: "user_profile",
      resource_id: profile.user_id,
      metadata: { assigned_role: role, requester_name: profile.full_name },
    });

    // Email the approved user (best-effort)
    const { data: requesterAuth } = await db.auth.admin.getUserById(profile.user_id);
    const { data: practiceRow } = await db
      .from("practices")
      .select("name")
      .eq("id", profile.matched_practice_id)
      .maybeSingle();
    if (requesterAuth.user?.email) {
      await sendEmail({
        to: requesterAuth.user.email,
        subject: `You're in: ${practiceRow?.name ?? "your practice"} on Fortify`,
        html: joinRequestApprovedEmail({
          practice_name: practiceRow?.name ?? "your practice",
          role_label: ROLE_LABELS[role],
          app_url: new URL(req.url).origin,
        }),
        tag: "request.approved",
      });
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  // ── Deny ────────────────────────────────────────────────────────────────
  const denialReason = body.denial_reason?.trim() || null;

  const { error: dErr } = await db
    .from("user_profiles")
    .update({
      status: "denied",
      decided_by: user.id,
      decided_at: now,
      denial_reason: denialReason,
    })
    .eq("user_id", profile.user_id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  await db.from("notifications").insert({
    user_id: profile.user_id,
    practice_id: profile.matched_practice_id,
    kind: "request.denied",
    title: "Access not granted",
    body:
      denialReason ??
      "An administrator at the practice you requested did not approve your access.",
    link: "/denied",
  });

  await db.from("audit_logs").insert({
    practice_id: profile.matched_practice_id,
    actor_user_id: user.id,
    action: "request.denied",
    resource_type: "user_profile",
    resource_id: profile.user_id,
    metadata: { reason: denialReason, requester_name: profile.full_name },
  });

  // Email the denied user (best-effort)
  const { data: deniedUser } = await db.auth.admin.getUserById(profile.user_id);
  const { data: practiceRow2 } = await db
    .from("practices")
    .select("name")
    .eq("id", profile.matched_practice_id)
    .maybeSingle();
  if (deniedUser.user?.email) {
    await sendEmail({
      to: deniedUser.user.email,
      subject: `Your access request was declined`,
      html: joinRequestDeniedEmail({
        practice_name: practiceRow2?.name ?? "the practice you requested",
        reason: denialReason,
        app_url: new URL(req.url).origin,
      }),
      tag: "request.denied",
    });
  }

  return NextResponse.json({ ok: true, status: "denied" });
}
