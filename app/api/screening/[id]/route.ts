import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { SCREENING_MESSAGES } from "@/lib/screening/user-message";

/**
 * GET the current state of a screening — used to re-hydrate the
 * verification modal across a page refresh.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: row } = await db
    .from("exclusion_screenings")
    .select("id, subject_user_id, subject_type, practice_id, status, screened_at, expires_at, user_message_shown")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Screening not found" }, { status: 404 });

  // Only the subject or an admin of the screening's practice can read.
  if (row.subject_user_id !== user.id) {
    if (!row.practice_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: membership } = await db
      .from("practice_users")
      .select("role")
      .eq("practice_id", row.practice_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const responseBody: Record<string, unknown> = {
    id: row.id,
    status: row.status,
    subject_type: row.subject_type,
    screened_at: row.screened_at,
    expires_at: row.expires_at,
  };
  if (row.status === "review_required") {
    responseBody.prompt = {
      message: SCREENING_MESSAGES.reviewRequired,
      explanation: SCREENING_MESSAGES.reviewExplanation,
      fields: ["middle_name", "address_line", "city", "state", "zip"],
    };
  } else if (row.status === "blocked") {
    responseBody.user_message = row.user_message_shown ?? SCREENING_MESSAGES.blockedFinal;
  }

  return NextResponse.json(responseBody);
}
