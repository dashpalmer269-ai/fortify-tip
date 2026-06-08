/**
 * Fortify-admin: create + list invite codes.
 *
 * Gated by isFortifyAdmin() — only emails in the FORTIFY_ADMIN_EMAILS env
 * var (comma-separated) can create or list codes. The granted_by column
 * pins to the calling user's id so multi-admin teams can each see their
 * own codes via the "own read" RLS policy.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { isFortifyAdmin } from "@/lib/billing/admin";
import {
  generateInviteCode,
  hashInviteCode,
  DEFAULT_ACCESS_MINUTES,
  DEFAULT_LINK_WINDOW_HOURS,
} from "@/lib/billing/invites";

export const runtime = "nodejs";

interface CreateBody {
  access_duration_minutes?: number;
  link_window_hours?: number;
  note?: string;
}

export async function POST(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFortifyAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const accessMinutes = Math.max(1, Math.min(43_200, body.access_duration_minutes ?? DEFAULT_ACCESS_MINUTES));
  const linkHours = Math.max(1, Math.min(720, body.link_window_hours ?? DEFAULT_LINK_WINDOW_HOURS));
  const note = body.note?.trim().slice(0, 500) ?? null;

  const plaintext = generateInviteCode();
  const linkExpiresAt = new Date(Date.now() + linkHours * 60 * 60 * 1000).toISOString();

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Only the sha256 hash persists in the DB. The plaintext exists in this
  // response and in the granter's clipboard — never read back from the
  // database. The list endpoint cannot show URLs because of this.
  const { data: inserted, error } = await db
    .from("invite_codes")
    .insert({
      code_hash: hashInviteCode(plaintext),
      granted_by: user.id,
      access_duration_minutes: accessMinutes,
      link_expires_at: linkExpiresAt,
      note,
    })
    .select("id, access_duration_minutes, link_expires_at, note, granted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...inserted,
    url: `${req.nextUrl.origin}/signup?invite=${encodeURIComponent(plaintext)}`,
    plaintext_warning:
      "Save the URL now — for security the plaintext code is not stored and cannot be retrieved.",
  });
}

export async function GET(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFortifyAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: codes } = await db
    .from("invite_codes")
    .select(
      "id, access_duration_minutes, used_count, max_uses, link_expires_at, revoked_at, note, granted_at"
    )
    .eq("granted_by", user.id)
    .order("granted_at", { ascending: false })
    .limit(200);

  // Sidecar: redemption summary per code.
  const ids = (codes ?? []).map((c) => c.id);
  const { data: redemptions } = ids.length
    ? await db
        .from("invite_redemptions")
        .select("code_id, redeemed_at, access_expires_at, user_id")
        .in("code_id", ids)
    : { data: [] };

  const byCode = new Map<string, typeof redemptions>();
  for (const r of redemptions ?? []) {
    const arr = byCode.get(r.code_id) ?? [];
    arr.push(r);
    byCode.set(r.code_id, arr);
  }

  // No `url` field — codes are hashed, plaintext is unrecoverable. Granter
  // had to save the URL at creation time (the warning is in the POST
  // response).
  const enriched = (codes ?? []).map((c) => ({
    ...c,
    redemptions: byCode.get(c.id) ?? [],
  }));

  return NextResponse.json({ codes: enriched });
}
