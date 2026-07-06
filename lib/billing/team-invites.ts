/**
 * Team invite helpers (practice_invites — migration 048).
 *
 * Distinct from the demo-access invite_codes system in lib/billing/invites.ts:
 * these invite a specific person BY EMAIL into an existing practice with a
 * pre-assigned role. Token posture matches invite_codes — the DB stores only
 * sha256(token), the plaintext lives in the emailed /join/<token> URL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateInviteCode, hashInviteCode } from "@/lib/billing/invites";
import type { AssignableRole } from "@/lib/auth/permissions";

export const TEAM_INVITE_EXPIRY_DAYS = 14;

export interface PendingInvite {
  id: string;
  practice_id: string;
  email: string;
  role: AssignableRole;
  invited_by: string | null;
  expires_at: string;
}

export function generateTeamInviteToken(): { token: string; token_hash: string } {
  const token = generateInviteCode();
  return { token, token_hash: hashInviteCode(token) };
}

export function isInviteExpired(invite: { expires_at: string }, now = new Date()): boolean {
  return new Date(invite.expires_at).getTime() < now.getTime();
}

/** Look up a live (pending, unexpired) invite by its URL token. */
export async function findPendingInviteByToken(
  db: SupabaseClient<Database>,
  token: string
): Promise<PendingInvite | null> {
  if (!token || token.length < 8 || token.length > 64) return null;
  const { data } = await db
    .from("practice_invites")
    .select("id, practice_id, email, role, invited_by, expires_at, status")
    .eq("token_hash", hashInviteCode(token))
    .maybeSingle();
  if (!data || data.status !== "pending" || isInviteExpired(data)) return null;
  return data as PendingInvite;
}

/** Look up a live invite matching a verified email address. */
export async function findPendingInviteByEmail(
  db: SupabaseClient<Database>,
  email: string
): Promise<PendingInvite | null> {
  const { data } = await db
    .from("practice_invites")
    .select("id, practice_id, email, role, invited_by, expires_at, status")
    .eq("email", email.trim().toLowerCase())
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || isInviteExpired(data)) return null;
  return data as PendingInvite;
}

export type RedeemOutcome =
  | { ok: true; practice_id: string; role: AssignableRole }
  | { ok: false; reason: "already_member" | "email_mismatch" | "db_error"; error?: string };

/**
 * Create the membership an invite promises and mark the invite accepted.
 *
 * Caller must pass a service-role client (practice_invites writes and
 * practice_users inserts for a not-yet-member user both bypass RLS) and a
 * user whose email is VERIFIED by Supabase Auth — both redemption paths
 * (auth callback, /api/invites/redeem) only run post-authentication.
 */
export async function redeemInvite(
  db: SupabaseClient<Database>,
  invite: PendingInvite,
  user: { id: string; email: string }
): Promise<RedeemOutcome> {
  // The invite is a grant to an address, not a bearer link: whoever redeems
  // must own the invited mailbox. Token-path callers hit this check too.
  if (user.email.trim().toLowerCase() !== invite.email) {
    return { ok: false, reason: "email_mismatch" };
  }

  // A user can only belong to one practice (single-practice product).
  const { data: existing } = await db
    .from("practice_users")
    .select("practice_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_member" };

  const { error: muErr } = await db.from("practice_users").insert({
    practice_id: invite.practice_id,
    user_id: user.id,
    role: invite.role,
  });
  if (muErr) return { ok: false, reason: "db_error", error: muErr.message };

  const now = new Date().toISOString();
  await db
    .from("practice_invites")
    .update({ status: "accepted", accepted_at: now, accepted_user_id: user.id })
    .eq("id", invite.id)
    .eq("status", "pending");

  // Invited users skip the join-request queue; mark any profile approved so
  // session state never dangles in "pending".
  await db
    .from("user_profiles")
    .update({ status: "approved", matched_practice_id: invite.practice_id })
    .eq("user_id", user.id);

  await db.from("audit_logs").insert({
    practice_id: invite.practice_id,
    actor_user_id: user.id,
    action: "team_invite.accepted",
    resource_type: "practice_invite",
    resource_id: invite.id,
    metadata: { email: invite.email, role: invite.role },
  });

  if (invite.invited_by) {
    await db.from("notifications").insert({
      user_id: invite.invited_by,
      practice_id: invite.practice_id,
      kind: "team_invite.accepted",
      title: "Invitation accepted",
      body: `${invite.email} joined the practice.`,
      link: "/app/team",
    });
  }

  return { ok: true, practice_id: invite.practice_id, role: invite.role };
}

/**
 * Best-effort silent redemption for the auth callback: if the just-verified
 * email has a live invite and the user has no membership yet, join them.
 * Never throws — signup must not break because of an invite hiccup.
 */
export async function redeemPendingInviteByEmail(
  db: SupabaseClient<Database>,
  user: { id: string; email: string }
): Promise<boolean> {
  try {
    const invite = await findPendingInviteByEmail(db, user.email);
    if (!invite) return false;
    const outcome = await redeemInvite(db, invite, user);
    return outcome.ok;
  } catch {
    return false;
  }
}
