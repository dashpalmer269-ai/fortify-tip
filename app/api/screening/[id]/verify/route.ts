import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { VerifyScreeningSchema } from "@/lib/schemas/screening";
import { completeVerification } from "@/lib/screening/service";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Tier-2 verification. The user supplies middle name and/or their last
 * tax-return address; we rule out tier-1 candidates that clearly don't
 * match. Surviving candidates → blocked. Empty survivor set → cleared.
 *
 * Owns the side effect of suspending workforce access on a blocked outcome.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(VerifyScreeningSchema, req, {
    phiFields: ["middle_name", "address_line"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Authorize: the screening must belong to the caller OR the caller must
  // be an admin of the screening's practice.
  const { data: screening } = await db
    .from("exclusion_screenings")
    .select("subject_user_id, practice_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!screening) return NextResponse.json({ error: "Screening not found" }, { status: 404 });

  if (screening.subject_user_id !== user.id) {
    // Maybe caller is admin of the practice?
    if (!screening.practice_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: membership } = await db
      .from("practice_users")
      .select("role")
      .eq("practice_id", screening.practice_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Verification is a workforce action, but if there's a practice context,
  // an expired demo should still be blocked. Self-verification with no
  // practice context (e.g. during onboarding) is allowed.
  if (screening.practice_id) {
    const guard = await requirePracticeAccess(db, screening.practice_id);
    if (!guard.ok) return guard.response;
  }

  try {
    const result = await completeVerification(db, {
      screeningId: id,
      middleName: body.middle_name ?? null,
      addressLine: body.address_line ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
    });

    return NextResponse.json(
      {
        screening_id: result.screeningId,
        status: result.status,
        ...(result.userMessage ? { user_message: result.userMessage } : {}),
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = (e as Error).message;
    const status = /not found/i.test(msg) ? 404 : /state/i.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
