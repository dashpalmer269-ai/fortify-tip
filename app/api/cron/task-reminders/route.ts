import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/provider";
import { taskReminderEmail, baaExpiringEmail } from "@/lib/email/templates";
import { getOfficerRecipients } from "@/lib/email/recipients";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * Daily human-notification cron (09:00 UTC). Two duties:
 *
 *   1. Task reminders — each assignee with tasks due within 3 days or
 *      already overdue gets ONE digest email + in-app notification.
 *   2. BAA expiry alerts — practice officers get a heads-up when an active
 *      BAA hits a milestone (30/14/7/3/1 days out). Milestone-gated so a
 *      daily cron doesn't nag daily about the same agreement.
 *
 * Both live here because Vercel Hobby caps cron entries — this is the
 * one daily "notify humans" job.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const baaResult = await sendBaaExpiryAlerts(db, origin);

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
    return NextResponse.json({ ok: true, assignees_notified: 0, tasks_considered: 0, ...baaResult });
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

  return NextResponse.json({
    ok: true,
    assignees_notified: notified,
    tasks_considered: tasks.length,
    ...baaResult,
  });
}

/** Days-out milestones that trigger a BAA expiry email. */
const BAA_ALERT_MILESTONES = new Set([30, 14, 7, 3, 1]);

async function sendBaaExpiryAlerts(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  origin: string
): Promise<{ baa_alerts_sent: number; baas_expiring_30d: number }> {
  const today = new Date();
  const horizon = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const { data: baas } = await db
    .from("baas")
    .select("id, practice_id, vendor_id, expiration_date")
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .gte("expiration_date", today.toISOString().slice(0, 10))
    .lte("expiration_date", horizon);
  if (!baas || baas.length === 0) return { baa_alerts_sent: 0, baas_expiring_30d: 0 };

  // Milestone gate: only alert at 30/14/7/3/1 days out.
  const midnightUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const due = baas.filter((b) => {
    const days = Math.round((new Date(b.expiration_date!).getTime() - midnightUtc) / 86400_000);
    return BAA_ALERT_MILESTONES.has(days);
  });
  if (due.length === 0) return { baa_alerts_sent: 0, baas_expiring_30d: baas.length };

  const practiceIds = [...new Set(due.map((b) => b.practice_id))];
  const [{ emailsByPractice, userIdsByPractice }, { data: practiceRows }, { data: vendorRows }] =
    await Promise.all([
      getOfficerRecipients(db, practiceIds),
      db.from("practices").select("id, name").in("id", practiceIds),
      db
        .from("vendors")
        .select("id, vendor_name")
        .in("id", [...new Set(due.map((b) => b.vendor_id))]),
    ]);
  const practiceName = new Map((practiceRows ?? []).map((p) => [p.id, p.name]));
  const vendorName = new Map((vendorRows ?? []).map((v) => [v.id, v.vendor_name]));

  let sent = 0;
  for (const baa of due) {
    const days = Math.round((new Date(baa.expiration_date!).getTime() - midnightUtc) / 86400_000);
    const vendor = vendorName.get(baa.vendor_id) ?? "a vendor";
    const recipients = emailsByPractice.get(baa.practice_id) ?? [];

    // In-app notification for every officer, email alongside (best-effort).
    for (const userId of userIdsByPractice.get(baa.practice_id) ?? []) {
      await db.from("notifications").insert({
        user_id: userId,
        practice_id: baa.practice_id,
        kind: "baa.expiring",
        title: `BAA with ${vendor} expires in ${days} day${days === 1 ? "" : "s"}`,
        body: "Renew it to keep your HIPAA business-associate coverage intact.",
        link: "/app/vendors",
      });
    }

    if (recipients.length > 0) {
      const result = await sendEmail({
        to: recipients,
        subject: `BAA with ${vendor} expires in ${days} day${days === 1 ? "" : "s"}`,
        html: baaExpiringEmail({
          practice_name: practiceName.get(baa.practice_id) ?? "your practice",
          vendor_name: vendor,
          days_remaining: days,
          app_url: origin,
        }),
        tag: "baa.expiring",
      });
      if (result.ok) sent++;
    }
  }

  return { baa_alerts_sent: sent, baas_expiring_30d: baas.length };
}
