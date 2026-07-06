import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { TeamInviteRedeemSchema, parseBody } from "@/lib/schemas/api";
import {
  findPendingInviteByEmail,
  findPendingInviteByToken,
  redeemInvite,
} from "@/lib/billing/team-invites";

/**
 * Redeem a team invite for the signed-in user.
 *
 * Two lookup paths: by token (the /join/<token> Accept button) or, with no
 * token, by the caller's verified email (the "connect me" fallback). Both
 * end in redeemInvite(), which enforces the email match and one-practice
 * rule before creating the membership.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(TeamInviteRedeemSchema, req);
  if (!parsed.ok) return parsed.response;

  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const invite = parsed.data.token
    ? await findPendingInviteByToken(db, parsed.data.token)
    : await findPendingInviteByEmail(db, user.email);
  if (!invite) {
    return NextResponse.json(
      { error: "This invitation is no longer valid. Ask your practice admin to send a new one." },
      { status: 404 }
    );
  }

  const outcome = await redeemInvite(db, invite, { id: user.id, email: user.email });
  if (!outcome.ok) {
    if (outcome.reason === "email_mismatch") {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invite.email}. Sign in with that email to accept it.`,
        },
        { status: 403 }
      );
    }
    if (outcome.reason === "already_member") {
      return NextResponse.json(
        { error: "You already belong to a practice on Fortify." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: outcome.error ?? "Could not accept the invitation." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, practice_id: outcome.practice_id, role: outcome.role });
}
