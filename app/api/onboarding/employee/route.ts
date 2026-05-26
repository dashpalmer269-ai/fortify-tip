import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { EmployeeOnboardingSchema, parseBody } from "@/lib/schemas/api";

/**
 * Standard-user onboarding submit.
 *  - Validates body via zod (shape) + scanFieldsForPhi (No-PHI gate)
 *  - Writes user_profiles with status='pending'
 *  - Attempts to match a practice by claimed name (case-insensitive)
 *  - If matched, stores matched_practice_id and notifies every admin/owner
 *  - Audit log entry
 *
 * DEMO WORKAROUND: writes through service-role to dodge the auth.uid() RLS
 * issue documented in /api/onboarding/finalize. The user_id is pinned to
 * the authenticated caller so service-role isn't trusted with body data.
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
  }

  return NextResponse.json({ ok: true, matched: !!matchedPracticeId });
}
