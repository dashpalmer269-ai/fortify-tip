import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isOfficer, type Role } from "@/lib/auth/permissions";
import { generateTasksForPractice } from "@/lib/compliance/tasks";
import { summarizePracticePosture } from "@/lib/ai/compliance-ai";
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
}

function toTaskItems(rows: TaskRow[], emailByUser?: Map<string, string>): TaskItem[] {
  return rows.map((t) => ({
    id: t.id,
    title: t.title ?? "Task",
    source: t.source,
    status: t.status,
    severity: t.severity,
    due_date: t.due_date,
    subject_ref: t.subject_ref,
    assignee_email: emailByUser && t.assigned_to ? emailByUser.get(t.assigned_to) ?? null : null,
  }));
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function sortTasks(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity ?? "low"] ?? 3;
    const sb = SEVERITY_ORDER[b.severity ?? "low"] ?? 3;
    if (sa !== sb) return sa - sb;
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return da - db;
  });
}

export default async function DashboardPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const service = createServerClient();
  const role = session.membership.role as Role;
  const practiceId = session.membership.practice_id;
  const practiceName = session.membership.practice_name;

  // Keep the task surface fresh on every dashboard load (idempotent).
  if (service) {
    try {
      await generateTasksForPractice(service, practiceId);
    } catch {
      /* non-fatal */
    }
  }

  // ── Standard / auditor → employee dashboard (task-first) ──────────────────
  if (!isOfficer(role)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, job_title")
      .eq("user_id", session.user.id)
      .maybeSingle();

    const { data: myTasks } = await supabase
      .from("remediation_tasks")
      .select("id, title, source, status, severity, due_date, subject_ref, assigned_to")
      .eq("assigned_to", session.user.id)
      .in("status", ["open", "in_progress", "blocked"]);

    return (
      <DashboardEmployee
        practiceName={practiceName}
        fullName={profile?.full_name ?? null}
        jobTitle={profile?.job_title ?? null}
        userEmail={session.user.email ?? ""}
        role={role}
        tasks={toTaskItems(sortTasks((myTasks ?? []) as TaskRow[]))}
      />
    );
  }

  // ── Admin / officer dashboard ─────────────────────────────────────────────
  const { data: readiness } = await supabase.rpc("audit_readiness_summary", {
    p_practice_id: practiceId,
  });

  const { data: critical } = await supabase
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
    >();

  const { data: activity } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, metadata, occurred_at, actor_service")
    .eq("practice_id", practiceId)
    .order("occurred_at", { ascending: false })
    .limit(8);

  // Practice-wide open tasks (the punch list)
  const { data: practiceTasks } = await supabase
    .from("remediation_tasks")
    .select("id, title, source, status, severity, due_date, subject_ref, assigned_to")
    .eq("practice_id", practiceId)
    .in("status", ["open", "in_progress", "blocked"]);

  const sortedTasks = sortTasks((practiceTasks ?? []) as TaskRow[]);

  // Resolve assignee emails for the punch list
  const emailByUser = new Map<string, string>();
  if (service && sortedTasks.length > 0) {
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) if (u.email) emailByUser.set(u.id, u.email);
  }

  const readinessRows = (readiness ?? []) as Array<{
    framework_code: string;
    weighted_pct: number;
    satisfied: number;
    total: number;
  }>;
  const overallPct =
    readinessRows.length > 0
      ? Math.round(readinessRows.reduce((s, r) => s + (Number(r.weighted_pct) || 0), 0) / readinessRows.length)
      : 0;
  const criticalCount = (critical ?? []).filter((c) => c.controls?.default_priority === "critical").length;

  // AI narrative — "practice in a sentence." Best-effort; falls back to a
  // deterministic line if the AI call fails or isn't configured.
  let narrative: string | null = null;
  try {
    narrative = await summarizePracticePosture({
      practice_name: practiceName,
      overall_pct: overallPct,
      readiness: readinessRows.map((r) => ({ framework_code: r.framework_code, weighted_pct: r.weighted_pct })),
      open_tasks: sortedTasks.slice(0, 5).map((t) => ({
        title: t.title ?? "task",
        severity: t.severity ?? "low",
        overdue: !!t.due_date && new Date(t.due_date).getTime() < Date.now(),
      })),
      critical_open: criticalCount,
    });
  } catch {
    narrative =
      overallPct >= 80
        ? `${practiceName} is in strong shape at ${overallPct}% overall. ${sortedTasks.length} open ${sortedTasks.length === 1 ? "task" : "tasks"} to clear.`
        : `${practiceName} is at ${overallPct}% overall with ${criticalCount} critical ${criticalCount === 1 ? "item" : "items"} open. Start with the highest-severity task below.`;
  }

  return (
    <DashboardClient
      practiceName={practiceName}
      readiness={readinessRows}
      criticalCount={criticalCount}
      recentActivity={activity ?? []}
      narrative={narrative}
      tasks={toTaskItems(sortedTasks, emailByUser)}
    />
  );
}
