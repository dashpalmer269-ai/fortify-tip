import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { PreliminaryScreeningSchema } from "@/lib/schemas/screening";
import { startPreliminary } from "@/lib/screening/service";
import { SCREENING_MESSAGES } from "@/lib/screening/user-message";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Run a tier-1 exclusion screening on first + last + DOB.
 *
 * Returns:
 *   - 201 cleared → caller can proceed
 *   - 202 review_required → caller must collect middle name + tax address and POST to /[id]/verify
 *
 * Rate-limited: 10 per IP per hour, 30 per authenticated user per day. This
 * is the highest-abuse-potential surface of the screening system (name
 * enumeration), so the gate is tight.
 */
export async function POST(req: NextRequest) {
  // Rate limit (IP-level)
  const rl = checkRateLimit(`screen-prelim:${clientKey(req)}`, {
    capacity: 10,
    refillPerSecond: 10 / 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(PreliminaryScreeningSchema, req, {
    phiFields: ["first_name", "last_name"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Only gate when a practice context is present. A self-screening without
  // a practice (e.g. an onboarding pre-check) is allowed without billing.
  if (body.practice_id) {
    const guard = await requirePracticeAccess(db, body.practice_id);
    if (!guard.ok) return guard.response;
  }

  try {
    const result = await startPreliminary(db, {
      subjectType: body.subject_type,
      subjectUserId: body.subject_type === "workforce_member" ? user.id : null,
      subjectVendorId: body.vendor_id ?? null,
      practiceId: body.practice_id ?? null,
      firstName: body.first_name,
      lastName: body.last_name,
      dateOfBirth: body.date_of_birth,
    });

    if (result.status === "cleared") {
      return NextResponse.json(
        { screening_id: result.screeningId, status: "cleared" },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        screening_id: result.screeningId,
        status: "review_required",
        prompt: {
          message: SCREENING_MESSAGES.reviewRequired,
          explanation: SCREENING_MESSAGES.reviewExplanation,
          fields: ["middle_name", "address_line", "city", "state", "zip"],
        },
      },
      { status: 202 }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
