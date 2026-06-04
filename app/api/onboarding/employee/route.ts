import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { EmployeeOnboardingSchema, parseBody } from "@/lib/schemas/api";
import { sendEmail } from "@/lib/email/provider";
import { joinRequestCreatedEmail } from "@/lib/email/templates";

/**
 * Standard-user onboarding submit.
 *  - Validates body via zod (shape) + scanFieldsForPhi (No-PHI gate)
 *  - Writes user_profiles with status='pending'
 *  - Attempts to match a practice by claimed name (case-insensitive)
 *  - If matched, stores matched_practice_id and notifies every admin/owner
 *  - Audit log entry
 *
 * Service-role usage justification:
 *   The submitting user has no practice_users membership at this point in
 *   the flow (they're requesting to join one). RLS on `notifications` and
 *   `audit_logs` requires practice_id membership; service-role bypasses
 *   that for the legitimate cross-practice case of notifying admins.
 *
 * Safety invariants verified in this handler:
 *   - user.id is pulled from the authenticated JWT (line below), never
 *     from the request body
 *   - matchedPracticeId is resolved server-side from a name lookup, not
 *     trusted from the body
 *   - Body fields scanned for PHI patterns via scanFieldsForPhi
 *   - The user_profiles upsert pins user_id=auth.uid() — RLS would also
 *     enforce this if authed client were used; service-role honors it by
 *     explicit code
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(EmployeeOnboardingSchema, req, {
    phiFields: ["full_name", "job_title", "pending_practice_name", "claimed_admin_name"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // ── Match a practice by name (case-insensitive trim) ──────────────────────
  const claimedName = body.pending_practice_name;
  const { data: practiceMatch } = await db
    .from("practices")
    .select("id, name")
    .ilike("name", claimedName)
    .limit(1)
    .maybeSingle();
  const matchedPracticeId = practiceMatch?.id ?? null;

  const { error: upsertErr } = await db.from("user_profiles").upsert(
    {
      user_id: user.id,
      account_type: "employee",
      full_name: body.full_name,
      first_name: body.first_name,
      last_name: body.last_name,
      date_of_birth: body.date_of_birth,
      job_title: body.job_title,
      phone: body.phone?.trim() || null,
      pending_practice_name: claimedName,
      claimed_admin_name: body.claimed_admin_name,
      primary_address: body.primary_address,
      matched_practice_id: matchedPracticeId,
      status: "pending",
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  // ── Run exclusion screening immediately ────────────────────────────────
  // The status returned drives the client-side redirect:
  //   cleared → /pending (admin will approve)
  //   review_required → /screening/[id] (collect tier-2 inputs)
  //   blocked → /screening/[id]/blocked
  const { startPreliminary } = await import("@/lib/screening/service");
  const screening = await startPreliminary(db, {
    subjectType: "workforce_member",
    subjectUserId: user.id,
    practiceId: matchedPracticeId,
    firstName: body.first_name,
    lastName: body.last_name,
    dateOfBirth: body.date_of_birth,
  });

  if (matchedPracticeId) {
    const { data: admins } = await db
      .from("practice_users")
      .select("user_id")
      .eq("practice_id", matchedPracticeId)
      .in("role", ["owner", "admin"]);

    if (admins?.length) {
      await db.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.user_id,
          practice_id: matchedPracticeId,
          kind: "request.created",
          title: "New join request",
          body: `${body.full_name} (${body.job_title}) is requesting access.`,
          link: "/app/team",
        }))
      );
    }

    await db.from("audit_logs").insert({
      practice_id: matchedPracticeId,
      actor_user_id: user.id,
      action: "request.created",
      resource_type: "user_profile",
      resource_id: user.id,
      metadata: {
        full_name: body.full_name,
        job_title: body.job_title,
        claimed_admin_name: body.claimed_admin_name,
      },
    });

    // ── Email every admin/owner (best-effort; no-ops without RESEND_API_KEY) ──
    if (admins?.length) {
      const adminEmails: string[] = [];
      for (const a of admins) {
        const { data: u } = await db.auth.admin.getUserById(a.user_id);
        if (u.user?.email) adminEmails.push(u.user.email);
      }
      const appUrl = new URL(req.url).origin;
      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: `New join request for ${practiceMatch?.name ?? "your practice"}`,
          html: joinRequestCreatedEmail({
            practice_name: practiceMatch?.name ?? "your practice",
            requester_name: body.full_name,
            requester_job: body.job_title,
            app_url: appUrl,
          }),
          tag: "request.created",
        });
      }
    }
  }

  // Build a redirect target the client uses to route to the correct next view.
  const redirect =
    screening.status === "cleared"
      ? "/pending"
      : screening.status === "review_required"
      ? `/screening/${screening.screeningId}`
      : `/screening/${screening.screeningId}/blocked`;

  return NextResponse.json({
    ok: true,
    matched: !!matchedPracticeId,
    screening_status: screening.status,
    screening_id: screening.screeningId,
    redirect,
  });
}
