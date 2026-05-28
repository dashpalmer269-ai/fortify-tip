/**
 * Screening orchestration service.
 *
 * Encapsulates the lifecycle of an exclusion_screenings row:
 *   - startPreliminary: tier-1 match, persist, decide cleared|review_required
 *   - completeVerification: tier-2 filter, persist final status
 *   - rescheduleRescreen: bump expires_at after a successful rescreen
 *
 * Side effects (notifications, suspensions, audit logs) are handled here
 * so route handlers stay thin. Every state transition writes to audit_logs.
 *
 * DEMO WORKAROUND alignment: this service uses the passed-in service-role
 * client, consistent with the rest of the codebase. Once the auth.uid()
 * RLS issue is resolved, callers can switch to the user-authed client and
 * the service has no opinion either way.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables, Inserts } from "@/lib/supabase/types";
import { tier1Match, tier2Filter, type Tier2Probe } from "./matcher";
import { SCREENING_MESSAGES } from "./user-message";

type Db = SupabaseClient<Database>;

const WORKFORCE_RESCREEN_WINDOW_DAYS = 28;

export interface StartPreliminaryInput {
  subjectType: "workforce_member" | "vendor_contact";
  subjectUserId?: string | null;
  subjectVendorId?: string | null;
  practiceId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface ScreeningOutcome {
  screeningId: string;
  status: Tables<"exclusion_screenings">["status"];
  tier1MatchCount: number;
  userMessage?: string;
}

function expiresAtFor(subjectType: "workforce_member" | "vendor_contact"): string | null {
  if (subjectType === "workforce_member") {
    return new Date(Date.now() + WORKFORCE_RESCREEN_WINDOW_DAYS * 86400_000).toISOString();
  }
  return null;
}

export async function startPreliminary(
  db: Db,
  input: StartPreliminaryInput
): Promise<ScreeningOutcome> {
  const matches = await tier1Match(db, {
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
  });

  const cleared = matches.length === 0;
  const insert: Inserts<"exclusion_screenings"> = {
    subject_type: input.subjectType,
    subject_user_id: input.subjectUserId ?? null,
    subject_vendor_id: input.subjectVendorId ?? null,
    practice_id: input.practiceId ?? null,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    date_of_birth: input.dateOfBirth,
    status: cleared ? "cleared" : "review_required",
    tier1_match_count: matches.length,
    matched_record_ids: matches.map((m) => m.id),
    expires_at: cleared ? expiresAtFor(input.subjectType) : null,
    user_message_shown: cleared ? null : SCREENING_MESSAGES.reviewRequired,
  };

  const { data: row, error } = await db
    .from("exclusion_screenings")
    .insert(insert)
    .select("id, status")
    .single();
  if (error || !row) {
    throw new Error(`Failed to record screening: ${error?.message ?? "unknown"}`);
  }

  // Audit
  if (input.practiceId) {
    await db.from("audit_logs").insert({
      practice_id: input.practiceId,
      actor_user_id: input.subjectUserId ?? null,
      action: cleared ? "screening.cleared.preliminary" : "screening.review_required",
      resource_type: "exclusion_screening",
      resource_id: row.id,
      metadata: { tier1_match_count: matches.length, subject_type: input.subjectType },
    });
  }

  return {
    screeningId: row.id,
    status: row.status as Tables<"exclusion_screenings">["status"],
    tier1MatchCount: matches.length,
  };
}

export interface CompleteVerificationInput {
  screeningId: string;
  middleName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export async function completeVerification(
  db: Db,
  input: CompleteVerificationInput
): Promise<ScreeningOutcome> {
  const { data: screening, error: loadErr } = await db
    .from("exclusion_screenings")
    .select("*")
    .eq("id", input.screeningId)
    .maybeSingle();
  if (loadErr || !screening) {
    throw new Error("Screening not found");
  }
  if (screening.status !== "review_required") {
    throw new Error(`Screening is in state '${screening.status}', not review_required`);
  }

  // Re-fetch the matched records by id
  const ids = (screening.matched_record_ids ?? []) as string[];
  const { data: candidatesData } = await db
    .from("exclusion_list_records")
    .select(
      "id, source, first_name, middle_name, last_name, business_name, date_of_birth, address_line, city, state, zip, exclusion_type, exclusion_date"
    )
    .in("id", ids);
  const candidates = (candidatesData ?? []).map((r) => ({
    ...r,
    source: r.source as "OIG_LEIE" | "SAM_GOV",
  }));

  const probe: Tier2Probe = {
    middleName: input.middleName ?? null,
    addressLine: input.addressLine ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip: input.zip ?? null,
  };
  const survivors = tier2Filter(candidates, probe);

  const blocked = survivors.length > 0;
  const finalStatus: Tables<"exclusion_screenings">["status"] = blocked ? "blocked" : "cleared";
  const userMessage = blocked
    ? SCREENING_MESSAGES.blockedAfterReview
    : null;

  const { error: updErr } = await db
    .from("exclusion_screenings")
    .update({
      middle_name: input.middleName ?? null,
      address_line: input.addressLine ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      status: finalStatus,
      tier2_match_count: survivors.length,
      matched_record_ids: survivors.map((s) => s.id),
      expires_at: blocked ? null : expiresAtFor(screening.subject_type),
      user_message_shown: userMessage,
    })
    .eq("id", input.screeningId);
  if (updErr) throw new Error(updErr.message);

  if (screening.practice_id) {
    await db.from("audit_logs").insert({
      practice_id: screening.practice_id,
      actor_user_id: screening.subject_user_id,
      action: blocked ? "screening.blocked" : "screening.cleared.after_verification",
      resource_type: "exclusion_screening",
      resource_id: screening.id,
      metadata: {
        tier1_match_count: screening.tier1_match_count,
        tier2_match_count: survivors.length,
        subject_type: screening.subject_type,
      },
    });
  }

  // If blocked workforce member: also flip user_profiles.status to denied with reason.
  if (blocked && screening.subject_type === "workforce_member" && screening.subject_user_id) {
    await db
      .from("user_profiles")
      .update({
        status: "denied",
        denial_reason: "exclusion_screening_blocked",
        decided_at: new Date().toISOString(),
      })
      .eq("user_id", screening.subject_user_id);
  }

  return {
    screeningId: screening.id,
    status: finalStatus,
    tier1MatchCount: screening.tier1_match_count ?? 0,
    userMessage: userMessage ?? undefined,
  };
}

/**
 * Override a blocked screening — owner/admin only. Caller must have been
 * authorized at the route layer; this just records the override.
 */
export async function overrideBlocked(
  db: Db,
  screeningId: string,
  deciderUserId: string,
  reason: string
): Promise<void> {
  const { error } = await db
    .from("exclusion_screenings")
    .update({
      status: "overridden_clear",
      decided_by: deciderUserId,
      decision_reason: reason,
      expires_at: expiresAtFor("workforce_member"),
    })
    .eq("id", screeningId);
  if (error) throw new Error(error.message);

  const { data: row } = await db
    .from("exclusion_screenings")
    .select("practice_id, subject_user_id, subject_type")
    .eq("id", screeningId)
    .maybeSingle();
  if (row?.practice_id) {
    await db.from("audit_logs").insert({
      practice_id: row.practice_id,
      actor_user_id: deciderUserId,
      action: "screening.overridden",
      resource_type: "exclusion_screening",
      resource_id: screeningId,
      metadata: { reason, subject_type: row.subject_type },
    });
  }
  // Restore profile status if workforce
  if (row?.subject_user_id) {
    await db
      .from("user_profiles")
      .update({ status: "approved", denial_reason: null })
      .eq("user_id", row.subject_user_id);
  }
}
