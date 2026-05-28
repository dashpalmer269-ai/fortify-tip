import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { OverrideScreeningSchema } from "@/lib/schemas/screening";
import { overrideBlocked } from "@/lib/screening/service";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * Override a blocked screening. Owner/admin only. Always audit-logs the
 * decision-maker and the written reason.
 *
 * Use this when a screening false-positive is confirmed (the workforce
 * member contacted support, support verified identity through external means,
 * admin is restoring access).
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

  const parsed = await parseBody(OverrideScreeningSchema, req, { phiFields: ["reason"] });
  if (!parsed.ok) return parsed.response;

  const { data: screening } = await db
    .from("exclusion_screenings")
    .select("practice_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!screening) return NextResponse.json({ error: "Screening not found" }, { status: 404 });
  if (screening.status !== "blocked") {
    return NextResponse.json(
      { error: `Cannot override a screening in state '${screening.status}'` },
      { status: 409 }
    );
  }
  if (!screening.practice_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: membership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", screening.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !isAdmin(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await overrideBlocked(db, id, user.id, parsed.data.reason);
    return NextResponse.json({ ok: true, status: "overridden_clear" }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
