/**
 * Unified evidence flow — the single pipeline every cybersecurity feature
 * runs through. One function, every trigger.
 *
 *   TRIGGER ──→ COLLECT ──→ VERIFY ──→ PERSIST ──→ DRIFT ──→ RECOMPUTE ──→ AUDIT
 *
 * Triggers that call this:
 *   - Cron (verify-compliance scan)        every hour
 *   - File upload finalize                  on document_upload arrival
 *   - Manual attestation                    on attest button click
 *   - Future: external webhook              architecture-ready
 *
 * Every cybersecurity feature ultimately produces the five things the user
 * specified:
 *   1. evidence       → practice_evidence row (+ optional evidence_file_url)
 *   2. finding        → status pass/fail/partial/not_collected/error
 *   3. task           → auto_control task created on fail (via task generator)
 *   4. dashboard      → practice_controls.status rolled up
 *   5. audit log      → audit_logs row attributing trigger + actor
 *
 * This module is the source of truth for that loop. Do not write evidence
 * rows from anywhere else.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CheckResult, EvidenceCheckRow } from "./runner";
import { recomputeControlStatus, stateHash } from "./runner";
import { persistEvidence } from "./evidence-persistence";

type Db = SupabaseClient<Database>;

export type Trigger =
  | "cron"                 // hourly verify-compliance scan
  | "document_upload"      // practice uploaded a file
  | "manual_attestation"   // practice clicked "Attest now"
  | "api_webhook"          // future: external system pushed event
  | "admin_action";        // future: admin "Run check now"

export interface EvidenceFlowOptions {
  /** What kicked this flow off — recorded on the audit log entry. */
  trigger: Trigger;
  /** User who triggered, if any (null for cron). */
  actorUserId?: string | null;
  /** Storage path of the uploaded file, if this came from a document upload. */
  evidenceFileUrl?: string | null;
  /** Free-text note attached to the evidence row. */
  notes?: string | null;
  /** Regenerate tasks for the practice after recompute. Defaults true. */
  regenerateTasks?: boolean;
}

export interface EvidenceFlowResult {
  evidenceId: string | null;
  /** Did the collector output pass verifyCollected? */
  verified: boolean;
  /** Did the state change vs the last is_current row? */
  drift_detected: boolean;
  /** The status that landed in practice_evidence (may differ from input if downgraded). */
  persisted_status: string;
  /** New rollup status of the parent control after recompute. */
  control_status: string | null;
}

/**
 * Run the full evidence pipeline for one (practice, check) pair.
 *
 * Steps, in order:
 *   1. Look up the previous is_current evidence row (for drift detection).
 *   2. Persist the new evidence (verifies the collector envelope, flips
 *      is_current on the prior row, writes the new row).
 *   3. Write an immutable evidence_snapshots row (historical trail).
 *   4. If state changed AND new status is fail → drift_alert row.
 *   5. Recompute practice_controls.status from current evidence.
 *   6. Audit-log this evidence collection with trigger + actor attribution.
 *   7. Optionally regenerate tasks for the practice (defaults true; cron
 *      batches this at the end of its full sweep instead).
 *
 * Any individual step that errors is logged but the function returns its
 * partial outcome rather than throwing — compliance evidence collection
 * is best-effort and the audit log captures gaps.
 */
export async function runEvidenceFlow(
  db: Db,
  practiceId: string,
  check: EvidenceCheckRow,
  collectorResult: CheckResult,
  options: EvidenceFlowOptions
): Promise<EvidenceFlowResult> {
  const regenerateTasks = options.regenerateTasks !== false;

  // 1. Read previous is_current row (for drift detection)
  const { data: lastRows } = await db
    .from("practice_evidence")
    .select("collected_at, state_hash, status, observed_value")
    .eq("practice_id", practiceId)
    .eq("evidence_check_id", check.id)
    .eq("is_current", true)
    .limit(1);
  const last = lastRows?.[0];

  // 2. Persist new evidence (the verifier rewrites bad collector output to
  //    status='error' so the audit trail records the gap)
  const persisted = await persistEvidence(db, practiceId, check, collectorResult, {
    collectedByUserId: options.actorUserId ?? null,
    evidenceFileUrl: options.evidenceFileUrl ?? null,
    notes: options.notes ?? null,
  });

  const persistedStatus = persisted.verified ? collectorResult.status : "error";
  const hashSource =
    persisted.verified &&
    (collectorResult.status === "pass" || collectorResult.status === "fail" || collectorResult.status === "partial")
      ? collectorResult.observed_value
      : { status: persistedStatus, raw: collectorResult.raw };
  const newHash = stateHash(hashSource);

  // 3. Immutable snapshot for the historical trail
  await db.from("evidence_snapshots").insert({
    practice_id: practiceId,
    evidence_check_id: check.id,
    state_hash: newHash,
    observed_value: collectorResult.observed_value as never,
  });

  // 4. Drift detection — state changed AND failing
  let driftDetected = false;
  if (last && last.state_hash !== newHash && persistedStatus === "fail") {
    driftDetected = true;
    await db.from("drift_alerts").insert({
      practice_id: practiceId,
      evidence_check_id: check.id,
      previous_state: last.observed_value as never,
      current_state: collectorResult.observed_value as never,
      severity: "high",
    });
    await db.from("audit_logs").insert({
      practice_id: practiceId,
      actor_user_id: options.actorUserId ?? null,
      actor_service: options.trigger === "cron" ? "system_cron" : null,
      action: "evidence.drift_detected",
      resource_type: "practice_evidence",
      resource_id: check.id,
      metadata: {
        check_key: check.check_key,
        control_id: check.control_id,
        from_status: last.status,
        to_status: persistedStatus,
        trigger: options.trigger,
      },
    });
  }

  // 5. Roll up control status from current evidence
  let controlStatus: string | null = null;
  try {
    await recomputeControlStatus(db, practiceId, check.control_id);
    const { data: pc } = await db
      .from("practice_controls")
      .select("status")
      .eq("practice_id", practiceId)
      .eq("control_id", check.control_id)
      .maybeSingle();
    controlStatus = pc?.status ?? null;
  } catch (err) {
    console.error("[evidence-flow] recompute failed", {
      practice_id: practiceId,
      control_id: check.control_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 6. Audit-log the evidence collection itself
  await db.from("audit_logs").insert({
    practice_id: practiceId,
    actor_user_id: options.actorUserId ?? null,
    actor_service: options.trigger === "cron" ? "system_cron" : null,
    action: "evidence.collected",
    resource_type: "practice_evidence",
    resource_id: persisted.evidenceId,
    metadata: {
      check_key: check.check_key,
      control_id: check.control_id,
      status: persistedStatus,
      verified: persisted.verified,
      drift_detected: driftDetected,
      trigger: options.trigger,
      file_url: options.evidenceFileUrl ?? null,
    },
  });

  // 7. Task regeneration (defaults true; cron skips and batches at end)
  if (regenerateTasks) {
    try {
      const { generateTasksForPractice } = await import("./tasks");
      await generateTasksForPractice(db, practiceId, { force: true });
    } catch (err) {
      console.error("[evidence-flow] task regeneration failed", {
        practice_id: practiceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    evidenceId: persisted.evidenceId,
    verified: persisted.verified,
    drift_detected: driftDetected,
    persisted_status: persistedStatus,
    control_status: controlStatus,
  };
}
