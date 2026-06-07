/**
 * Fortify-admin: revoke an invite code.
 *
 * Sets revoked_at on the code. Existing redemptions (if any) are NOT
 * affected — once someone has redeemed, they keep their granted window.
 * Revoking only stops future redemptions of the link.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { isFortifyAdmin } from "@/lib/billing/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFortifyAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Verify the caller is the granter (defense in depth — RLS already enforces).
  const { data: existing } = await db
    .from("invite_codes")
    .select("id, granted_by, revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.granted_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.revoked_at) {
    return NextResponse.json({ ok: true, already_revoked: true });
  }

  const { error } = await db
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // No practice-scoped audit_log entry — invite_codes.revoked_at + the
  // calling user (granter) constitute the audit trail.
  return NextResponse.json({ ok: true });
}
