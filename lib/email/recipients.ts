/**
 * Recipient resolution for practice-level alert emails.
 *
 * "Officers" = owner / admin / compliance_officer — the people accountable
 * for compliance state. Cron senders resolve recipients in one pass:
 * one practice_users query + one auth.admin.listUsers call, shared across
 * every practice in the batch (same 200-user envelope the team page uses).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const OFFICER_ROLES = ["owner", "admin", "compliance_officer"] as const;

export interface OfficerRecipients {
  /** practice_id → officer emails (deduped, lowercase). */
  emailsByPractice: Map<string, string[]>;
  /** practice_id → officer user ids (for in-app notifications). */
  userIdsByPractice: Map<string, string[]>;
}

export async function getOfficerRecipients(
  db: SupabaseClient<Database>,
  practiceIds: string[]
): Promise<OfficerRecipients> {
  const emailsByPractice = new Map<string, string[]>();
  const userIdsByPractice = new Map<string, string[]>();
  if (practiceIds.length === 0) return { emailsByPractice, userIdsByPractice };

  const { data: officers } = await db
    .from("practice_users")
    .select("practice_id, user_id, role")
    .in("practice_id", practiceIds)
    .in("role", [...OFFICER_ROLES]);
  if (!officers || officers.length === 0) return { emailsByPractice, userIdsByPractice };

  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map<string, string>();
  for (const u of userList?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email.toLowerCase());
  }

  for (const o of officers) {
    const ids = userIdsByPractice.get(o.practice_id) ?? [];
    ids.push(o.user_id);
    userIdsByPractice.set(o.practice_id, ids);

    const email = emailById.get(o.user_id);
    if (!email) continue;
    const emails = emailsByPractice.get(o.practice_id) ?? [];
    if (!emails.includes(email)) emails.push(email);
    emailsByPractice.set(o.practice_id, emails);
  }

  return { emailsByPractice, userIdsByPractice };
}
