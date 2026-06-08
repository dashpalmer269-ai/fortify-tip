import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { TaskUpdateSchema } from "@/lib/schemas/tasks";
import { isAdmin } from "@/lib/auth/permissions";
import type { Updates } from "@/lib/supabase/types";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * PATCH-like POST /api/tasks/[id] — update a task.
 *
 * Authorization:
 *   - the assignee can change status + notes on their own task
 *   - an admin/owner can change anything (reassign, due date, status)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(TaskUpdateSchema, req, { phiFields: ["notes"] });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { data: task } = await db
    .from("remediation_tasks")
    .select("id, practice_id, assigned_to, status")
    .eq("id", id)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const guard = await requirePracticeAccess(db, task.practice_id);
  if (!guard.ok) return guard.response;

  const { data: membership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", task.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const callerIsAdmin = !!membership && isAdmin(membership.role);
  const callerIsAssignee = task.assigned_to === user.id;
  if (!callerIsAdmin && !callerIsAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Non-admin assignees can only touch status + notes (not reassign / due date).
  if (!callerIsAdmin && (body.assigned_to !== undefined || body.due_date !== undefined)) {
    return NextResponse.json({ error: "Only an admin can reassign or reschedule" }, { status: 403 });
  }

  const update: Updates<"remediation_tasks"> = {};
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "done") {
      update.completed_at = new Date().toISOString();
      update.completed_by = user.id;
    }
  }
  if (body.notes !== undefined) update.notes = body.notes;
  if (callerIsAdmin && body.assigned_to !== undefined) update.assigned_to = body.assigned_to;
  if (callerIsAdmin && body.due_date !== undefined) update.due_date = body.due_date;

  const { error } = await db.from("remediation_tasks").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status) {
    await db.from("audit_logs").insert({
      practice_id: task.practice_id,
      actor_user_id: user.id,
      action: `task.${body.status}`,
      resource_type: "remediation_task",
      resource_id: id,
      metadata: { from: task.status, to: body.status },
    });
  }

  return NextResponse.json({ ok: true });
}
