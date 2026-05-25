import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Standard (employee) onboarding: saves the verification info into
 * user_profiles so an admin can approve them.
 *
 * DEMO WORKAROUND (TODO: revisit after beta) — same RLS bypass pattern as
 * /api/onboarding/finalize. We auth the caller via the user cookie client
 * (gets user.id) and write with service-role to dodge the auth.uid() = null
 * issue inside RLS policies. The user_id on the upsert is pinned to the
 * authenticated user, not trusted from the body.
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
        primary_address?: Record<string, string | null>;
      }
    | null;

  if (
    !body?.full_name?.trim() ||
    !body.job_title?.trim() ||
    !body.pending_practice_name?.trim() ||
    !body.primary_address
  ) {
    return NextResponse.json({ error: "Missing required profile fields" }, { status: 400 });
  }

  const { error } = await db
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        account_type: "employee",
        full_name: body.full_name.trim(),
        job_title: body.job_title.trim(),
        phone: body.phone?.trim() || null,
        pending_practice_name: body.pending_practice_name.trim(),
        primary_address: body.primary_address,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
