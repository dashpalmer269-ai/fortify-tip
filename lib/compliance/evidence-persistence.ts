/**
 * Verify-before-push gate for evidence collection.
 *
 * Every CheckResult flows through verifyCollected() before it lands in
 * practice_evidence. The rule: an "evidence" row exists only when the
 * collector actually produced a verifiable observation. Anything else
 * (collector errored, returned empty, returned a malformed shape) is
 * recorded as 'error' with a clear reason so an auditor sees the gap.
 *
 * This is the difference between "we ran the cron" and "we have proof we
 * ran the cron and got a result." Compliance auditors care about the
 * latter — the raw_result column is the proof.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CheckStatus, CheckResult, EvidenceCheckRow } from "./runner";
import { stateHash } from "./runner";

type Db = SupabaseClient<Database>;

export interface VerificationOutcome {
  ok: boolean;
  reason?: string;
  /** The (possibly-rewritten) result to persist. */
  result: CheckResult;
}

/**
 * Validate a collector's output before persisting it.
 *
 * Rules a passing CheckResult must satisfy:
 *   1. status ∈ {pass, fail, partial} → observed_value MUST be non-null
 *      (a pass without an observed value isn't evidence, it's a claim).
 *   2. status === 'not_collected' → at minimum a `note` in raw explaining why
 *      (so an auditor can answer "why wasn't this collected on day N?").
 *   3. status === 'error' → raw.error MUST be a string (we never store
 *      "we errored but won't say how").
 *   4. observed_value, if present, MUST be a plain object — not a string,
 *      not an array — because the schema is { measured: ..., units: ... }-shaped.
 *
 * Violations are downgraded to status='error' with a verification_failed reason
 * so the audit trail records that we attempted collection and detected a bad
 * collector response. The original payload is preserved in raw.
 */
export function verifyCollected(check: EvidenceCheckRow, result: CheckResult): VerificationOutcome {
  // status must be a valid enum
  const validStatuses: CheckStatus[] = ["pass", "fail", "partial", "not_collected", "error"];
  if (!validStatuses.includes(result.status)) {
    return downgrade(check, result, `invalid status '${String(result.status)}'`);
  }

  if (result.status === "pass" || result.status === "fail" || result.status === "partial") {
    if (result.observed_value === null || result.observed_value === undefined) {
      return downgrade(check, result, `${result.status} requires non-null observed_value`);
    }
    if (typeof result.observed_value !== "object" || Array.isArray(result.observed_value)) {
      return downgrade(check, result, `observed_value must be a plain object`);
    }
  }

  if (result.status === "not_collected") {
    const raw = result.raw as { note?: string } | null;
    if (!raw || typeof raw.note !== "string" || raw.note.length === 0) {
      return downgrade(check, result, `not_collected requires a non-empty raw.note explaining why`);
    }
  }

  if (result.status === "error") {
    const raw = result.raw as { error?: string } | null;
    if (!raw || typeof raw.error !== "string" || raw.error.length === 0) {
      return downgrade(check, result, `error requires a non-empty raw.error message`);
    }
  }

  return { ok: true, result };
}

function downgrade(
  _check: EvidenceCheckRow,
  original: CheckResult,
  reason: string
): VerificationOutcome {
  return {
    ok: false,
    reason,
    result: {
      status: "error",
      observed_value: null,
      raw: { error: `verification_failed: ${reason}`, original_status: original.status, original_raw: original.raw },
    },
  };
}

/**
 * Persist a CheckResult into practice_evidence. Returns the inserted row id
 * (so the caller can attach it to a drift_alert if state changed) or null
 * on insert failure.
 *
 * Always runs verifyCollected() first. Always sets state_hash. Always marks
 * the previous current row for the same (practice, check) as is_current=false
 * so the latest write reflects the truth.
 */
export async function persistEvidence(
  db: Db,
  practiceId: string,
  check: EvidenceCheckRow,
  collectorResult: CheckResult,
  options: { collectedByUserId?: string | null } = {}
): Promise<{ evidenceId: string | null; verified: boolean; reason?: string }> {
  const verification = verifyCollected(check, collectorResult);
  const result = verification.result;

  // Mark prior is_current=true row for this (practice, check) as no longer current
  await db
    .from("practice_evidence")
    .update({ is_current: false })
    .eq("practice_id", practiceId)
    .eq("evidence_check_id", check.id)
    .eq("is_current", true);

  // Hash the observed_value (or the error envelope) so we can detect state change.
  const hashSource =
    result.status === "pass" || result.status === "fail" || result.status === "partial"
      ? result.observed_value
      : { status: result.status, raw: result.raw };
  const hash = stateHash(hashSource);

  // collected_by stays null for cron writes (system-generated evidence).
  // observed_value is stored as Json; raw_result captures the full collector envelope
  // so an auditor can replay what we saw.
  const { data: row, error } = await db
    .from("practice_evidence")
    .insert({
      practice_id: practiceId,
      evidence_check_id: check.id,
      status: result.status,
      collected_at: new Date().toISOString(),
      collected_by: options.collectedByUserId ?? null,
      raw_result: result.raw as never,
      observed_value: result.observed_value as never,
      state_hash: hash,
      notes:
        verification.ok
          ? null
          : `Collector output failed verification: ${verification.reason}`,
      is_current: true,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { evidenceId: null, verified: verification.ok, reason: error?.message };
  }
  return { evidenceId: row.id, verified: verification.ok, reason: verification.reason };
}
