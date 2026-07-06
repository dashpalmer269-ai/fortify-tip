import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { generateReportSummary } from "@/lib/ai/compliance-ai";
import { requirePracticeAccess } from "@/lib/billing/require-access";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const maxDuration = 60;

interface RequestBody {
  practice_id?: string;
  report_type?: string;
  framework?: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.practice_id) {
    return NextResponse.json({ error: "practice_id required" }, { status: 400 });
  }
  const reportType = body.report_type ?? "audit_readiness";

  const guard = await requirePracticeAccess(supabase, body.practice_id);
  if (!guard.ok) return guard.response;

  // Per-practice throttle on the expensive AI call.
  const rl = checkRateLimit(`ai:report:${body.practice_id}`, RATE_LIMITS.ai);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many report generations at once. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  // Recompute control statuses from satisfaction_rule + evidence currency
  // BEFORE reading them for the report. Without this the report can ship
  // a "compliant" status for a control whose evidence aged out yesterday.
  // Cheap on a per-practice scale; cron runs nightly but explicit recompute
  // here means the report is always self-consistent at write time.
  await supabase.rpc("recompute_practice_control_status", {
    p_practice_id: body.practice_id,
  });

  // Pull live state for the snapshot
  const { data: practice } = await supabase
    .from("practices")
    .select("name, frameworks_enabled")
    .eq("id", body.practice_id)
    .single();
  if (!practice) return NextResponse.json({ error: "Practice not found" }, { status: 404 });

  const { data: readiness } = await supabase.rpc("audit_readiness_summary", {
    p_practice_id: body.practice_id,
  });

  const { data: criticalOpenRows } = await supabase
    .from("practice_controls")
    .select("status, controls(default_priority)")
    .eq("practice_id", body.practice_id)
    .eq("status", "non_compliant")
    .returns<Array<{ status: string; controls: { default_priority: string } | null }>>();
  const criticalOpen = (criticalOpenRows ?? [])
    .filter((r) => r.controls?.default_priority === "critical").length;

  const { data: recentDrift } = await supabase
    .from("drift_alerts")
    .select("id", { count: "exact", head: false })
    .eq("practice_id", body.practice_id)
    .gte("detected_at", new Date(Date.now() - 30 * 86400000).toISOString());

  // Vendors missing BAA
  const { data: phiVendors } = await supabase
    .from("vendors")
    .select("id")
    .eq("practice_id", body.practice_id)
    .eq("phi_access", true);
  const vendorIds = (phiVendors ?? []).map((v) => v.id);
  let baasMissing = 0;
  if (vendorIds.length > 0) {
    const { data: activeBaas } = await supabase
      .from("baas")
      .select("vendor_id")
      .eq("practice_id", body.practice_id)
      .eq("status", "active")
      .in("vendor_id", vendorIds);
    const haveBaa = new Set((activeBaas ?? []).map((b) => b.vendor_id));
    baasMissing = vendorIds.filter((id) => !haveBaa.has(id)).length;
  }

  // ── Open + overdue remediation tasks ──────────────────────────────────
  const nowIso = new Date().toISOString();
  const { data: openTasks } = await supabase
    .from("remediation_tasks")
    .select("id, title, severity, due_date, status")
    .eq("practice_id", body.practice_id)
    .in("status", ["open", "in_progress", "blocked"])
    .returns<Array<{ id: string; title: string | null; severity: string | null; due_date: string | null; status: string }>>();
  const tasksOpen = openTasks?.length ?? 0;
  const tasksOverdue = (openTasks ?? []).filter(
    (t) => t.due_date && t.due_date < nowIso
  ).length;
  const tasksCritical = (openTasks ?? []).filter((t) => t.severity === "critical").length;

  // ── Workforce training currency ───────────────────────────────────────
  // Completions whose expiry is still in the future are "current".
  const { data: trainingRows } = await supabase
    .from("training_completions")
    .select("user_id, expires_on")
    .eq("practice_id", body.practice_id)
    .returns<Array<{ user_id: string; expires_on: string | null }>>();
  const trainingCurrent = (trainingRows ?? []).filter(
    (t) => !t.expires_on || t.expires_on > nowIso
  ).length;
  const trainingExpired = (trainingRows ?? []).filter(
    (t) => t.expires_on && t.expires_on <= nowIso
  ).length;

  // ── Exclusion screening posture ───────────────────────────────────────
  const { data: screeningRows } = await supabase
    .from("exclusion_screenings")
    .select("status, screened_at")
    .eq("practice_id", body.practice_id)
    .returns<Array<{ status: string; screened_at: string | null }>>();
  const screeningsTotal = screeningRows?.length ?? 0;
  const screeningsBlocked = (screeningRows ?? []).filter((s) => s.status === "blocked").length;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const screeningsStale = (screeningRows ?? []).filter(
    (s) => !s.screened_at || s.screened_at < thirtyDaysAgo
  ).length;

  const snapshot = {
    practice_name: practice.name,
    readiness,
    critical_open: criticalOpen,
    recent_drift_alerts_30d: recentDrift?.length ?? 0,
    vendors_missing_baa: baasMissing,
    // Remediation workload
    tasks_open: tasksOpen,
    tasks_overdue: tasksOverdue,
    tasks_critical: tasksCritical,
    // Workforce training
    training_current: trainingCurrent,
    training_expired: trainingExpired,
    // Exclusion screening
    screenings_total: screeningsTotal,
    screenings_blocked: screeningsBlocked,
    screenings_stale: screeningsStale,
    generated_at: new Date().toISOString(),
  };

  // Pre-insert the report so we always have a record
  const { data: report, error: insErr } = await supabase
    .from("reports")
    .insert({
      practice_id: body.practice_id,
      report_type: reportType,
      framework: body.framework ?? null,
      generated_by: user.id,
      snapshot,
    })
    .select()
    .single();
  if (insErr || !report) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  // AI summary
  try {
    const summary = await generateReportSummary({
      practice_name: practice.name,
      report_type: reportType,
      framework: body.framework ?? null,
      readiness_summary: (readiness ?? []) as never[],
      critical_open: criticalOpen,
      recent_drift_alerts: recentDrift?.length ?? 0,
      baas_missing: baasMissing,
      tasks_open: tasksOpen,
      tasks_overdue: tasksOverdue,
      training_expired: trainingExpired,
      screenings_blocked: screeningsBlocked,
      screenings_stale: screeningsStale,
    });

    await supabase
      .from("reports")
      .update({ ai_executive_summary: summary })
      .eq("id", report.id);

    await supabase.from("audit_logs").insert({
      practice_id: body.practice_id,
      actor_user_id: user.id,
      action: "report.generated",
      resource_type: "report",
      resource_id: report.id,
      metadata: { report_type: reportType, framework: body.framework ?? null },
    });

    return NextResponse.json({ id: report.id, summary });
  } catch (e) {
    return NextResponse.json(
      {
        id: report.id,
        warning: `Report saved without AI summary: ${(e as Error).message}`,
      },
      { status: 200 }
    );
  }
}
