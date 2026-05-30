/**
 * Task generator — the bridge between control/evidence state and the
 * "who needs to do what" surface.
 *
 * Two machine-generated sources:
 *   - auto_control : one open task per non-compliant/partial control,
 *                    assigned to the practice owner (admins reassign).
 *   - policy_ack   : one open task per (member, active policy) the member
 *                    hasn't acknowledged at the current version.
 *
 * Idempotent: the partial unique index (migration 021) guarantees we never
 * create a second open task for the same (practice, source, control, subject).
 * Auto-resolution closes tasks whose condition has cleared — a compliant
 * control closes its task; a recorded acknowledgement closes its policy_ack.
 *
 * Called after the verify-compliance cron recomputes control status, and on
 * demand from the dashboard loaders so the surface is never stale. The
 * dashboard caller throttles via `practices.tasks_last_generated_at` so a
 * tab refresh doesn't fan out new queries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

type Severity = "critical" | "high" | "medium" | "low";

const DUE_DAYS_BY_SEVERITY: Record<Severity, number> = {
  critical: 7,
  high: 14,
  medium: 30,
  low: 60,
};

const DASHBOARD_THROTTLE_MS = 10 * 60 * 1000; // 10 min

function dueDateFor(severity: Severity): string {
  const days = DUE_DAYS_BY_SEVERITY[severity] ?? 30;
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
}

export interface GenerationResult {
  auto_control_opened: number;
  auto_control_resolved: number;
  policy_ack_opened: number;
  policy_ack_resolved: number;
  skipped_throttled?: boolean;
}

export interface GenerationOptions {
  /**
   * Honor the dashboard throttle (skip when last run < 10min ago). The cron
   * and admin "run now" surfaces pass `force: true`.
   */
  force?: boolean;
}

type TaskInsert = Database["public"]["Tables"]["remediation_tasks"]["Insert"];

/**
 * Resolve the default assignee for control-level tasks: the practice owner,
 * falling back to the earliest admin.
 */
async function defaultControlAssignee(db: Db, practiceId: string): Promise<string | null> {
  const { data: owner } = await db
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (owner) return owner.user_id;

  const { data: admin } = await db
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return admin?.user_id ?? null;
}

export async function generateTasksForPractice(
  db: Db,
  practiceId: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const result: GenerationResult = {
    auto_control_opened: 0,
    auto_control_resolved: 0,
    policy_ack_opened: 0,
    policy_ack_resolved: 0,
  };

  // ── Throttle (dashboard path) ──────────────────────────────────────────
  if (!options.force) {
    const { data: practiceRow } = await db
      .from("practices")
      .select("tasks_last_generated_at")
      .eq("id", practiceId)
      .maybeSingle();
    const last = practiceRow?.tasks_last_generated_at
      ? new Date(practiceRow.tasks_last_generated_at).getTime()
      : 0;
    if (Date.now() - last < DASHBOARD_THROTTLE_MS) {
      return { ...result, skipped_throttled: true };
    }
  }

  // ── auto_control tasks ──────────────────────────────────────────────────
  const assignee = await defaultControlAssignee(db, practiceId);

  // Current control states for this practice, joined to control metadata.
  const { data: pcs } = await db
    .from("practice_controls")
    .select("control_id, status, controls(control_key, title, default_priority)")
    .eq("practice_id", practiceId)
    .returns<
      Array<{
        control_id: string;
        status: string;
        controls: { control_key: string; title: string; default_priority: string | null } | null;
      }>
    >();

  // Existing open auto_control tasks keyed by control_id
  const { data: openAuto } = await db
    .from("remediation_tasks")
    .select("id, control_id")
    .eq("practice_id", practiceId)
    .eq("source", "auto_control")
    .in("status", ["open", "in_progress", "blocked"]);
  const openByControl = new Map<string, string>();
  for (const t of openAuto ?? []) if (t.control_id) openByControl.set(t.control_id, t.id);

  const failing = new Set<string>();
  const autoInserts: TaskInsert[] = [];
  for (const pc of pcs ?? []) {
    const needsTask = pc.status === "non_compliant" || pc.status === "partial";
    if (!needsTask) continue;
    failing.add(pc.control_id);
    if (openByControl.has(pc.control_id)) continue;

    const severity = (pc.controls?.default_priority as Severity) ?? "medium";
    autoInserts.push({
      practice_id: practiceId,
      control_id: pc.control_id,
      source: "auto_control",
      title: `Remediate: ${pc.controls?.title ?? pc.controls?.control_key ?? "control"}`,
      status: "open",
      severity,
      assigned_to: assignee,
      due_date: dueDateFor(severity),
    });
  }

  if (autoInserts.length > 0) {
    const { data: inserted, error } = await db
      .from("remediation_tasks")
      .insert(autoInserts)
      .select("id");
    if (error) {
      console.error("[tasks.generate] auto_control insert failed", {
        practice_id: practiceId,
        count: autoInserts.length,
        error: error.message,
      });
    } else {
      result.auto_control_opened = inserted?.length ?? 0;
    }
  }

  // Auto-resolve open auto_control tasks whose control is no longer failing
  const autoResolveIds: string[] = [];
  for (const [controlId, taskId] of openByControl) {
    if (!failing.has(controlId)) autoResolveIds.push(taskId);
  }
  if (autoResolveIds.length > 0) {
    const { error } = await db
      .from("remediation_tasks")
      .update({ status: "done", completed_at: new Date().toISOString(), completed_by: null })
      .in("id", autoResolveIds);
    if (error) {
      console.error("[tasks.generate] auto_control resolve failed", {
        practice_id: practiceId,
        count: autoResolveIds.length,
        error: error.message,
      });
    } else {
      result.auto_control_resolved = autoResolveIds.length;
    }
  }

  // ── policy_ack tasks ────────────────────────────────────────────────────
  const { data: activePolicies } = await db
    .from("policies")
    .select("id, title, version")
    .eq("practice_id", practiceId)
    .eq("status", "active");

  if (activePolicies && activePolicies.length > 0) {
    const { data: members } = await db
      .from("practice_users")
      .select("user_id")
      .eq("practice_id", practiceId);
    const memberIds = (members ?? []).map((m) => m.user_id);

    const policyIds = activePolicies.map((p) => p.id);
    const { data: acks } = await db
      .from("policy_acknowledgments")
      .select("policy_id, user_id, policy_version")
      .eq("practice_id", practiceId)
      .in("policy_id", policyIds);
    const ackedSet = new Set(
      (acks ?? []).map((a) => `${a.policy_id}:${a.user_id}:${a.policy_version}`)
    );

    const { data: openAck } = await db
      .from("remediation_tasks")
      .select("id, subject_ref, assigned_to")
      .eq("practice_id", practiceId)
      .eq("source", "policy_ack")
      .in("status", ["open", "in_progress", "blocked"]);
    const openAckKey = new Set(
      (openAck ?? []).map((t) => `${t.subject_ref}:${t.assigned_to}`)
    );
    const openAckById = new Map(
      (openAck ?? []).map((t) => [`${t.subject_ref}:${t.assigned_to}`, t.id])
    );

    const stillNeeded = new Set<string>();
    const ackInserts: TaskInsert[] = [];
    for (const policy of activePolicies) {
      for (const memberId of memberIds) {
        const acked = ackedSet.has(`${policy.id}:${memberId}:${policy.version ?? 1}`);
        if (acked) continue;
        const key = `${policy.id}:${memberId}`;
        stillNeeded.add(key);
        if (openAckKey.has(key)) continue;

        ackInserts.push({
          practice_id: practiceId,
          source: "policy_ack",
          subject_ref: policy.id,
          title: `Acknowledge policy: ${policy.title}`,
          status: "open",
          severity: "low",
          assigned_to: memberId,
          due_date: dueDateFor("low"),
        });
      }
    }

    if (ackInserts.length > 0) {
      const { data: inserted, error } = await db
        .from("remediation_tasks")
        .insert(ackInserts)
        .select("id");
      if (error) {
        console.error("[tasks.generate] policy_ack insert failed", {
          practice_id: practiceId,
          count: ackInserts.length,
          error: error.message,
        });
      } else {
        result.policy_ack_opened = inserted?.length ?? 0;
      }
    }

    const ackResolveIds: string[] = [];
    for (const [key, taskId] of openAckById) {
      if (!stillNeeded.has(key)) ackResolveIds.push(taskId);
    }
    if (ackResolveIds.length > 0) {
      const { error } = await db
        .from("remediation_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .in("id", ackResolveIds);
      if (error) {
        console.error("[tasks.generate] policy_ack resolve failed", {
          practice_id: practiceId,
          count: ackResolveIds.length,
          error: error.message,
        });
      } else {
        result.policy_ack_resolved = ackResolveIds.length;
      }
    }
  }

  // Mark the run so the dashboard throttle can skip the next call.
  await db
    .from("practices")
    .update({ tasks_last_generated_at: new Date().toISOString() })
    .eq("id", practiceId);

  return result;
}
