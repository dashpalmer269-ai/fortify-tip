/**
 * Public invite code preview.
 *
 * Called by the signup page when the URL has `?invite=...`. Returns minimal
 * info needed to show the welcome banner ("You're invited — 1 hour of demo
 * access included"). Does NOT redeem the code; redemption happens at
 * onboarding finalize after a real account is created.
 *
 * Rate-limited by IP — a brute-force attacker can't enumerate valid codes
 * by trying short values, both because the codes are 16 bytes of entropy
 * AND because we throttle the preview endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`invite-preview:${clientKey(req)}`, RATE_LIMITS.signup);
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code || code.length < 8 || code.length > 64) {
    return NextResponse.json({ valid: false, reason: "invalid_format" });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ valid: false, reason: "service_unavailable" }, { status: 503 });

  const { data: row } = await db
    .from("invite_codes")
    .select("id, access_duration_minutes, used_count, max_uses, link_expires_at, revoked_at")
    .eq("code", code)
    .maybeSingle();

  if (!row) return NextResponse.json({ valid: false, reason: "not_found" });
  if (row.revoked_at) return NextResponse.json({ valid: false, reason: "revoked" });
  if (row.used_count >= row.max_uses) return NextResponse.json({ valid: false, reason: "depleted" });
  if (new Date(row.link_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({
    valid: true,
    access_minutes: row.access_duration_minutes,
  });
}
