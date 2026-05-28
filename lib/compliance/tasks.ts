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
 * demand from the dashboard loaders so the surface is never stale.
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

function dueDateFor(severity: Severity): string {
  const days = DUE_DAYS_BY_SEVERITY[severity] ?? 30;
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
}

export interface GenerationResult {
  auto_control_opened: number;
  auto_control_resolved: number;
  policy_ack_opened: number;
  policy_ack_resolved: number;
}

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
  practiceId: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    auto_control_opened: 0,
    auto_control_resolved: 0,
    policy_ack_opened: 0,
    policy_ack_resolved: 0,
  };

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
  for (const pc of pcs ?? []) {
    const needsTask = pc.status === "non_compliant" || pc.status === "partial";
    if (!needsTask) continue;
    failing.add(pc.control_id);
    if (openByControl.has(pc.control_id)) continue; // already has an open task

    const severity = (pc.controls?.default_priority as Severity) ?? "medium";
    const { error } = await db.from("remediation_tasks").insert({
      practice_id: practiceId,
      control_id: pc.control_id,
      source: "auto_control",
      title: `Remediate: ${pc.controls?.title ?? pc.controls?.control_key ?? "control"}`,
      status: "open",
      severity,
      assigned_to: assignee,
      due_date: dueDateFor(severity),
    });
    if (!error) result.auto_control_opened++;
  }

  // Auto-resolve open auto_control tasks whose control is no longer failing.
  for (const [controlId, taskId] of openByControl) {
    if (!failing.has(controlId)) {
      const { error } = await db
        .from("remediation_tasks")
        .update({ status: "done", completed_at: new Date().toISOString(), completed_by: null })
        .eq("id", taskId);
      if (!error) result.auto_control_resolved++;
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

    // All current-version acknowledgements for these policies
    const policyIds = activePolicies.map((p) => p.id);
    const { data: acks } = await db
      .from("policy_acknowledgments")
      .select("policy_id, user_id, policy_version")
      .eq("practice_id", practiceId)
      .in("policy_id", policyIds);
    const ackedSet = new Set(
      (acks ?? []).map((a) => `${a.policy_id}:${a.user_id}:${a.policy_version}`)
    );

    // Existing open policy_ack tasks keyed by subject_ref:assignee
    const { data: openAck } = await db
      .from("remediation_tasks")
      .select("id, subject_ref, assigned_to")
      .eq("practice_id", practiceId)
      .eq("source", "policy_ack")
      .in("status", ["open", "in_progress", "blocked"]);
    const openAckKey = new Set(
      (openAck ?? []).map((t) => `${t.subject_ref}:${t.assigned_to}`)
    );
    const openAckById = new Map((openAck ?? []).map((t) => [`${t.subject_ref}:${t.assigned_to}`, t.id]));

    const stillNeeded = new Set<string>();
    for (const policy of activePolicies) {
      for (const memberId of memberIds) {
        const acked = ackedSet.has(`${policy.id}:${memberId}:${policy.version ?? 1}`);
        if (acked) continue;
        const key = `${policy.id}:${memberId}`;
        stillNeeded.add(key);
        if (openAckKey.has(key)) continue;

        const { error } = await db.from("remediation_tasks").insert({
          practice_id: practiceId,
          source: "policy_ack",
          subject_ref: policy.id,
          title: `Acknowledge policy: ${policy.title}`,
          status: "open",
          severity: "low",
          assigned_to: memberId,
          due_date: dueDateFor("low"),
        });
        if (!error) result.policy_ack_opened++;
      }
    }

    // Auto-resolve policy_ack tasks that are now acknowledged
    for (const [key, taskId] of openAckById) {
      if (!stillNeeded.has(key)) {
        const { error } = await db
          .from("remediation_tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", taskId);
        if (!error) result.policy_ack_resolved++;
      }
    }
  }

  return result;
}
