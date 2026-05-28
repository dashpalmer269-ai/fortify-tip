import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { TaskCreateSchema } from "@/lib/schemas/tasks";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * GET /api/tasks?scope=mine|practice  → list tasks
 * POST /api/tasks  → admin creates a manual task
 */
export async function GET(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ items: [] });

  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";

  const { data: membership } = await db
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let query = db
    .from("remediation_tasks")
    .select("id, title, source, status, severity, due_date, assigned_to, control_id, subject_ref, created_at, completed_at")
    .in("status", ["open", "in_progress", "blocked"])
    .order("severity", { ascending: true })
    .order("due_date", { ascending: true });

  if (scope === "practice") {
    if (!membership || !isAdmin(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("practice_id", membership.practice_id);
  } else {
    query = query.eq("assigned_to", user.id);
  }

  const { data: items } = await query;
  return NextResponse.json({ items: items ?? [] });
}

export async function POST(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(TaskCreateSchema, req, { phiFields: ["title", "notes"] });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { data: membership } = await db
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !isAdmin(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error } = await db
    .from("remediation_tasks")
    .insert({
      practice_id: membership.practice_id,
      source: "manual",
      title: body.title,
      status: "open",
      severity: body.severity ?? "medium",
      assigned_to: body.assigned_to ?? user.id,
      due_date: body.due_date ?? null,
      notes: body.notes ?? null,
      control_id: body.control_id ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });

  await db.from("audit_logs").insert({
    practice_id: membership.practice_id,
    actor_user_id: user.id,
    action: "task.created",
    resource_type: "remediation_task",
    resource_id: row.id,
    metadata: { title: body.title, source: "manual" },
  });

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
