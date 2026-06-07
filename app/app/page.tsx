import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isOfficer, type Role } from "@/lib/auth/permissions";
import { generateTasksForPractice } from "@/lib/compliance/tasks";
import { getOrGenerateNarrative } from "@/lib/dashboard/narrative";
import type { TaskItem } from "@/components/app/TaskList";
import DashboardClient from "./DashboardClient";
import DashboardEmployee from "./DashboardEmployee";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  title: string | null;
  source: string;
  status: string;
  severity: "critical" | "high" | "medium" | "low" | null;
  due_date: string | null;
  subject_ref: string | null;
  assigned_to: string | null;
  controls: {
    control_key: string;
    remediation_guide: string | null;
    default_weight: number | null;
    responsible_role: string | null;
  } | null;
}

const TASK_SELECT =
  "id, title, source, status, severity, due_date, subject_ref, assigned_to, controls(control_key, remediation_guide, default_weight, responsible_role)";

/**
 * Risk score = severity multiplier × control weight × overdue multiplier.
 * Higher score = higher priority. Drives the punch-list sort so a
 * non-compliant MFA control (weight 2.0) outranks a stale documentation
 * refinement (weight 0.5) even if both are 'high' severity.
 */
const SEVERITY_FACTOR: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
function riskScore(t: TaskRow, now: number): number {
  const sev = SEVERITY_FACTOR[t.severity ?? "low"] ?? 1;
  const weight = t.controls?.default_weight ?? 1.0;
  const overdue = t.due_date && new Date(t.due_date).getTime() < now ? 1.5 : 1.0;
  return sev * weight * overdue;
}

function toTaskItems(rows: TaskRow[], emailByUser?: Map<string, string>): TaskItem[] {
  const now = Date.now();
  return rows.map((t) => ({
    id: t.id,
    title: t.title ?? "Task",
    source: t.source,
    status: t.status,
    severity: t.severity,
    due_date: t.due_date,
    subject_ref: t.subject_ref,
    assignee_email: emailByUser && t.assigned_to ? emailByUser.get(t.assigned_to) ?? null : null,
    control_key: t.controls?.control_key ?? null,
    remediation_guide: t.controls?.remediation_guide ?? null,
    responsible_role: t.controls?.responsible_role ?? null,
    risk_score: riskScore(t, now),
  }));
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function sortTasks(rows: TaskRow[]): TaskRow[] {
  const now = Date.now();
  return [...rows].sort((a, b) => {
    // Risk-weighted: severity × control weight × overdue multiplier
    const ra = riskScore(a, now);
    const rb = riskScore(b, now);
    if (ra !== rb) return rb - ra; // higher risk first
    // Tie-break: severity ladder then due date
    const sa = SEVERITY_ORDER[a.severity ?? "low"] ?? 3;
    const sb = SEVERITY_ORDER[b.severity ?? "low"] ?? 3;
    if (sa !== sb) return sa - sb;
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return da - db;
  });
}

/**
 * Resolve a small set of user IDs to emails via targeted lookups, not a full
 * tenant list. Bound by the count of distinct task assignees.
 */
async function emailsForAssignees(
  service: NonNullable<ReturnType<typeof createServerClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(userIds));
  const results = await Promise.all(
    unique.map(async (id) => {
      try {
        const { data } = await service.auth.admin.getUserById(id);
        return [id, data.user?.email ?? null] as const;
      } catch (err) {
        console.error("[dashboard] assignee email lookup failed", { user_id: id, error: err instanceof Error ? err.message : String(err) });
        return [id, null] as const;
      }
    })
  );
  for (const [id, email] of results) if (email) map.set(id, email);
  return map;
}

export default async function DashboardPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const service = createServerClient();
  const role = session.membership.role as Role;
  const practiceId = session.membership.practice_id;
  const practiceName = session.membership.practice_name;

  // Keep the task surface fresh. Throttled in the generator to once per 10min
  // per practice — so a tab refresh doesn't re-run the whole regen.
  if (service) {
    generateTasksForPractice(service, practiceId).catch((err) => {
      console.error("[dashboard] task generation failed", {
        practice_id: practiceId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // ── Standard / auditor → employee dashboard (task-first) ──────────────────
  if (!isOfficer(role)) {
    const [profileRes, myTasksRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("full_name, job_title")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("remediation_tasks")
        .select(TASK_SELECT)
        .eq("assigned_to", session.user.id)
        .in("status", ["open", "in_progress", "blocked"])
        .returns<TaskRow[]>(),
    ]);

    return (
      <DashboardEmployee
        practiceName={practiceName}
        fullName={profileRes.data?.full_name ?? null}
        jobTitle={profileRes.data?.job_title ?? null}
        userEmail={session.user.email ?? ""}
        role={role}
        tasks={toTaskItems(sortTasks(myTasksRes.data ?? []))}
      />
    );
  }

  // ── Admin / officer dashboard — every query independent, fan out in parallel.
  //    audit_readiness_v2 returns:
  //      framework_code, weighted_pct, satisfied_count, total_count,
  //      category_breakdown
  //    PLUS five practice-wide totals replicated across every framework row:
  //      open_critical_tasks, overdue_tasks, expired_baas, stale_screenings,
  //      drift_alerts_open
  //    We still keep the criticalRes query for the *control-level* critical
  //    surface (different semantics from open_critical_tasks, which counts
  //    open critical *remediation tasks*).
  const [readinessRes, criticalRes, activityRes, practiceTasksRes] = await Promise.all([
    supabase.rpc("audit_readiness_v2", { p_practice_id: practiceId }),
    supabase
      .from("practice_controls")
      .select("id, status, controls(control_key, title, default_priority, category)")
      .eq("practice_id", practiceId)
      .eq("status", "non_compliant")
      .returns<
        Array<{
          id: string;
          status: string;
          controls: { control_key: string; title: string; default_priority: string; category: string } | null;
        }>
      >(),
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, metadata, occurred_at, actor_service")
      .eq("practice_id", practiceId)
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase
      .from("remediation_tasks")
      .select(TASK_SELECT)
      .eq("practice_id", practiceId)
      .in("status", ["open", "in_progress", "blocked"])
      .returns<TaskRow[]>(),
  ]);

  interface ReadinessRowV2 {
    framework_code: string;
    weighted_pct: number;
    satisfied_count: number;
    total_count: number;
    category_breakdown: unknown;
    open_critical_tasks: number;
    overdue_tasks: number;
    expired_baas: number;
    stale_screenings: number;
    drift_alerts_open: number;
  }
  const v2Rows = (readinessRes.data ?? []) as ReadinessRowV2[];
  // The dashboard client still consumes the simpler {satisfied, total} shape;
  // map v2 → that shape so we don't churn the client interface.
  const readinessRows = v2Rows.map((r) => ({
    framework_code: r.framework_code,
    weighted_pct: r.weighted_pct,
    satisfied: r.satisfied_count,
    total: r.total_count,
  }));
  // v2's practice-wide totals are replicated across every framework row;
  // take them from the first row, default to zero if there are no frameworks.
  const v2Summary = v2Rows[0] ?? {
    open_critical_tasks: 0,
    overdue_tasks: 0,
    expired_baas: 0,
    stale_screenings: 0,
    drift_alerts_open: 0,
  };

  const critical = criticalRes.data ?? [];
  const sortedTasks = sortTasks(practiceTasksRes.data ?? []);

  const overallPct =
    readinessRows.length > 0
      ? Math.round(readinessRows.reduce((s, r) => s + (Number(r.weighted_pct) || 0), 0) / readinessRows.length)
      : 0;
  const criticalCount = critical.filter((c) => c.controls?.default_priority === "critical").length;

  // Targeted email lookup: only the distinct assignees on visible tasks.
  const assigneeIds = sortedTasks
    .map((t) => t.assigned_to)
    .filter((id): id is string => !!id);
  const emailByUser =
    service && assigneeIds.length > 0
      ? await emailsForAssignees(service, assigneeIds)
      : new Map<string, string>();

  // Cached AI narrative — regenerates only when the state hash changes.
  // Fallback to deterministic line if AI is unavailable.
  const topTaskSigs = sortedTasks
    .slice(0, 5)
    .map((t) => `${t.id}:${t.status}:${t.due_date ?? ""}`);
  const fallbackNarrative =
    overallPct >= 80
      ? `${practiceName} is in strong shape at ${overallPct}% overall. ${sortedTasks.length} open ${sortedTasks.length === 1 ? "task" : "tasks"} to clear.`
      : `${practiceName} is at ${overallPct}% overall with ${criticalCount} critical ${criticalCount === 1 ? "item" : "items"} open. Start with the highest-severity task below.`;

  const narrative = service
    ? (await getOrGenerateNarrative(
        service,
        practiceId,
        {
          practice_name: practiceName,
          overall_pct: overallPct,
          readiness: readinessRows.map((r) => ({ framework_code: r.framework_code, weighted_pct: r.weighted_pct })),
          open_tasks: sortedTasks.slice(0, 5).map((t) => ({
            title: t.title ?? "task",
            severity: t.severity ?? "low",
            // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is per-request not per-render
            overdue: !!t.due_date && new Date(t.due_date).getTime() < Date.now(),
          })),
          critical_open: criticalCount,
        },
        topTaskSigs
      )) || fallbackNarrative
    : fallbackNarrative;

  return (
    <DashboardClient
      practiceName={practiceName}
      readiness={readinessRows}
      criticalCount={criticalCount}
      recentActivity={activityRes.data ?? []}
      narrative={narrative}
      tasks={toTaskItems(sortedTasks, emailByUser)}
      readinessSignals={{
        open_critical_tasks: v2Summary.open_critical_tasks,
        overdue_tasks: v2Summary.overdue_tasks,
        expired_baas: v2Summary.expired_baas,
        stale_screenings: v2Summary.stale_screenings,
        drift_alerts_open: v2Summary.drift_alerts_open,
      }}
    />
  );
}
