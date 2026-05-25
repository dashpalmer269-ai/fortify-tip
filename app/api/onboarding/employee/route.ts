import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Standard-user onboarding submit.
 *  - Writes the user_profiles row with status='pending'
 *  - Attempts to match a practice by claimed name (case-insensitive)
 *  - If matched, stores matched_practice_id and notifies every admin/owner
 *  - Audit log entry
 *
 * DEMO WORKAROUND: writes go through service-role to dodge the RLS bug
 * documented in /api/onboarding/finalize. The user_id is pinned to the
 * authenticated caller so service-role isn't trusted with body data.
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | {
        full_name?: string;
        job_title?: string;
        phone?: string | null;
        pending_practice_name?: string;
        claimed_admin_name?: string;
        primary_address?: Record<string, string | null>;
      }
    | null;

  if (
    !body?.full_name?.trim() ||
    !body.job_title?.trim() ||
    !body.pending_practice_name?.trim() ||
    !body.claimed_admin_name?.trim() ||
    !body.primary_address
  ) {
    return NextResponse.json({ error: "Missing required profile fields" }, { status: 400 });
  }

  // ── Attempt to match a practice by name (case-insensitive trim) ──────────
  const claimedName = body.pending_practice_name.trim();
  const { data: practiceMatch } = await db
    .from("practices")
    .select("id, name")
    .ilike("name", claimedName)
    .limit(1)
    .maybeSingle();
  const matchedPracticeId = practiceMatch?.id ?? null;

  // ── Upsert profile in pending state ──────────────────────────────────────
  const { error: upsertErr } = await db
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        account_type: "employee",
        full_name: body.full_name.trim(),
        job_title: body.job_title.trim(),
        phone: body.phone?.trim() || null,
        pending_practice_name: claimedName,
        claimed_admin_name: body.claimed_admin_name.trim(),
        primary_address: body.primary_address,
        matched_practice_id: matchedPracticeId,
        status: "pending",
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  // ── Notify every admin/owner of the matched practice ─────────────────────
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
          body: `${body.full_name!.trim()} (${body.job_title!.trim()}) is requesting access.`,
          link: "/app/team",
        }))
      );
    }

    // Audit log
    await db.from("audit_logs").insert({
      practice_id: matchedPracticeId,
      actor_user_id: user.id,
      action: "request.created",
      resource_type: "user_profile",
      resource_id: user.id,
      metadata: {
        full_name: body.full_name.trim(),
        job_title: body.job_title.trim(),
        claimed_admin_name: body.claimed_admin_name.trim(),
      },
    });
  }

  return NextResponse.json({ ok: true, matched: !!matchedPracticeId });
}
