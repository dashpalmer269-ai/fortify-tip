import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { TeamInviteQueueSchema, parseBody } from "@/lib/schemas/api";
import { isAdmin, ROLE_LABELS } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";
import { generateTeamInviteToken, TEAM_INVITE_EXPIRY_DAYS } from "@/lib/billing/team-invites";
import { sendEmail } from "@/lib/email/provider";
import { inviteEmail } from "@/lib/email/templates";

interface SkippedInvite {
  email: string;
  reason: "already_member" | "already_invited" | "send_failed" | "db_error";
}

/**
 * Create + email team invites (practice_invites, migration 048).
 *
 * Caller must be owner/admin of the practice. Each address gets a row with
 * a hashed one-time token and an email whose /join/<token> link redeems it.
 * Addresses that already belong to the practice or already have a live
 * invite are reported back as skipped, not errors — the UI shows both.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(TeamInviteQueueSchema, req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Caller must administer the target practice (RLS-equivalent check).
  const { data: callerMembership } = await supabase
    .from("practice_users")
    .select("role")
    .eq("practice_id", body.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership || !isAdmin(callerMembership.role)) {
    return NextResponse.json(
      { error: "You must be an admin or owner of this practice to invite people." },
      { status: 403 }
    );
  }

  const guard = await requirePracticeAccess(supabase, body.practice_id);
  if (!guard.ok) return guard.response;

  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: practiceRow } = await db
    .from("practices")
    .select("name")
    .eq("id", body.practice_id)
    .maybeSingle();
  const practiceName = practiceRow?.name ?? "your practice";

  // Existing members by email — invites to them are pointless.
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const memberEmails = new Set<string>();
  if (userList?.users.length) {
    const { data: memberships } = await db
      .from("practice_users")
      .select("user_id")
      .eq("practice_id", body.practice_id);
    const memberIds = new Set((memberships ?? []).map((m) => m.user_id));
    for (const u of userList.users) {
      if (u.email && memberIds.has(u.id)) memberEmails.add(u.email.toLowerCase());
    }
  }

  const origin = new URL(req.url).origin;
  const expiresAt = new Date(
    Date.now() + TEAM_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const queued: string[] = [];
  const skipped: SkippedInvite[] = [];

  // Dedupe addresses within the batch itself.
  const seen = new Set<string>();

  for (const invite of body.invites) {
    if (seen.has(invite.email)) continue;
    seen.add(invite.email);

    if (memberEmails.has(invite.email)) {
      skipped.push({ email: invite.email, reason: "already_member" });
      continue;
    }

    const { token, token_hash } = generateTeamInviteToken();
    const { error: insErr } = await db.from("practice_invites").insert({
      practice_id: body.practice_id,
      email: invite.email,
      role: invite.role,
      token_hash,
      invited_by: user.id,
      expires_at: expiresAt,
    });
    if (insErr) {
      // 23505 = unique_violation on the one-pending-invite-per-address index.
      skipped.push({
        email: invite.email,
        reason: insErr.code === "23505" ? "already_invited" : "db_error",
      });
      continue;
    }

    const sent = await sendEmail({
      to: invite.email,
      subject: `You've been invited to ${practiceName} on Fortify`,
      html: inviteEmail({
        practice_name: practiceName,
        role: ROLE_LABELS[invite.role],
        invite_url: `${origin}/join/${token}`,
      }),
      tag: "team-invite",
    });
    if (!sent.ok) {
      // Leave the row: the admin can see it on the team page and revoke or
      // re-invite. Surfacing the failure beats silently eating it.
      skipped.push({ email: invite.email, reason: "send_failed" });
      continue;
    }

    queued.push(invite.email);
  }

  if (queued.length > 0) {
    await db.from("audit_logs").insert({
      practice_id: body.practice_id,
      actor_user_id: user.id,
      action: "team_invite.sent",
      resource_type: "practice_invites",
      resource_id: null,
      metadata: { count: queued.length, emails: queued },
    });
  }

  return NextResponse.json({ ok: true, queued: queued.length, skipped });
}
