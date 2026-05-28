import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/provider";
import { taskReminderEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * Daily task reminder nudge (09:00 UTC).
 *
 * For each assignee with tasks due within 3 days or already overdue, sends a
 * single digest email + an in-app notification. One message per assignee per
 * run — we don't spam per-task.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);

  // Open tasks that are due soon or overdue, with an assignee.
  const { data: tasks } = await db
    .from("remediation_tasks")
    .select("id, practice_id, assigned_to, title, severity, due_date, status")
    .in("status", ["open", "in_progress", "blocked"])
    .not("assigned_to", "is", null)
    .not("due_date", "is", null)
    .lte("due_date", soon)
    .order("due_date", { ascending: true });

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, assignees_notified: 0, tasks_considered: 0 });
  }

  // Group by assignee
  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.assigned_to) continue;
    if (!byAssignee.has(t.assigned_to)) byAssignee.set(t.assigned_to, []);
    byAssignee.get(t.assigned_to)!.push(t);
  }

  const today = new Date().toISOString().slice(0, 10);
  let notified = 0;

  for (const [userId, userTasks] of byAssignee) {
    const overdue = userTasks.filter((t) => t.due_date && t.due_date < today);
    const dueSoon = userTasks.filter((t) => t.due_date && t.due_date >= today);

    // In-app notification (one per assignee)
    await db.from("notifications").insert({
      user_id: userId,
      practice_id: userTasks[0]?.practice_id ?? null,
      kind: "task.reminder",
      title:
        overdue.length > 0
          ? `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`
          : `${dueSoon.length} task${dueSoon.length === 1 ? "" : "s"} due soon`,
      body: userTasks
        .slice(0, 3)
        .map((t) => t.title)
        .join("; ")
        .slice(0, 240),
      link: "/app",
    });

    // Email (best-effort)
    const { data: u } = await db.auth.admin.getUserById(userId);
    if (u.user?.email) {
      await sendEmail({
        to: u.user.email,
        subject:
          overdue.length > 0
            ? `You have ${overdue.length} overdue compliance task${overdue.length === 1 ? "" : "s"}`
            : `${dueSoon.length} compliance task${dueSoon.length === 1 ? "" : "s"} due soon`,
        html: taskReminderEmail({
          overdue: overdue.map((t) => ({ title: t.title ?? "Task", due_date: t.due_date ?? "" })),
          due_soon: dueSoon.map((t) => ({ title: t.title ?? "Task", due_date: t.due_date ?? "" })),
          app_url: origin,
        }),
        tag: "task.reminder",
      });
    }
    notified++;
  }

  return NextResponse.json({ ok: true, assignees_notified: notified, tasks_considered: tasks.length });
}
