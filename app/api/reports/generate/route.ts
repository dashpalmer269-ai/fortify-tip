import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { generateReportSummary } from "@/lib/ai/compliance-ai";

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
    .eq("status", "non_compliant");
  const criticalOpen = (criticalOpenRows ?? [])
    .map((r) => r.controls as unknown as { default_priority: string } | null)
    .filter((c) => c?.default_priority === "critical").length;

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

  const snapshot = {
    practice_name: practice.name,
    readiness,
    critical_open: criticalOpen,
    recent_drift_alerts_30d: recentDrift?.length ?? 0,
    vendors_missing_baa: baasMissing,
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
