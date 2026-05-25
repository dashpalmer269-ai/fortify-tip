import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { computeBaselineRiskScore } from "@/lib/compliance/risk-questions";
import { summarizeRiskAssessment } from "@/lib/ai/compliance-ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { practice_id?: string; framework?: string; answers?: Record<string, string> }
    | null;
  if (!body?.practice_id || !body.answers) {
    return NextResponse.json({ error: "practice_id and answers required" }, { status: 400 });
  }

  // Pull practice context for the AI summary
  const { data: practice } = await supabase
    .from("practices")
    .select("name, practice_type, size_tier")
    .eq("id", body.practice_id)
    .single();
  if (!practice) return NextResponse.json({ error: "Practice not found" }, { status: 404 });

  // Pull current readiness + open critical controls
  const framework = body.framework ?? "HIPAA";
  const { data: readiness } = await supabase.rpc("audit_readiness", {
    p_practice_id: body.practice_id,
    p_framework_code: framework,
  });
  const readinessPct = readiness?.[0]?.weighted_pct ?? null;

  const { data: openCritical } = await supabase
    .from("practice_controls")
    .select("controls(title, default_priority)")
    .eq("practice_id", body.practice_id)
    .eq("status", "non_compliant");
  const criticalTitles = (openCritical ?? [])
    .map((p) => p.controls as unknown as { title: string; default_priority: string } | null)
    .filter((c) => c && c.default_priority === "critical")
    .map((c) => c!.title);

  // Baseline score from answer weights (always works without AI)
  const baselineScore = computeBaselineRiskScore(body.answers);

  // Insert as draft first so we always have a row even if AI fails
  const { data: created, error: insErr } = await supabase
    .from("risk_assessments")
    .insert({
      practice_id: body.practice_id,
      framework,
      assessor_user_id: user.id,
      status: "draft",
      answers: body.answers,
      risk_score: baselineScore,
      risk_level:
        baselineScore >= 75 ? "critical" :
        baselineScore >= 50 ? "high" :
        baselineScore >= 25 ? "medium" : "low",
    })
    .select()
    .single();
  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  // Now call Claude for the executive summary + remediation plan
  try {
    const ai = await summarizeRiskAssessment({
      practice_name: practice.name,
      practice_type: practice.practice_type,
      size_tier: practice.size_tier,
      framework,
      answers: body.answers,
      current_readiness_pct: readinessPct,
      open_critical_controls: criticalTitles,
    });

    await supabase
      .from("risk_assessments")
      .update({
        risk_score: ai.risk_score,
        risk_level: ai.risk_level,
        ai_executive_summary: ai.executive_summary,
        ai_remediation_plan: ai.remediation_plan,
        status: "submitted",
      })
      .eq("id", created.id);

    await supabase.from("audit_logs").insert({
      practice_id: body.practice_id,
      actor_user_id: user.id,
      action: "risk_assessment.completed",
      resource_type: "risk_assessment",
      resource_id: created.id,
      metadata: { framework, risk_level: ai.risk_level, risk_score: ai.risk_score },
    });

    return NextResponse.json({ id: created.id, ai });
  } catch (e) {
    // AI failure — keep the draft with baseline scoring, surface the error.
    return NextResponse.json(
      {
        id: created.id,
        warning: `Saved as draft. AI summary failed: ${(e as Error).message}`,
        baseline_score: baselineScore,
      },
      { status: 200 }
    );
  }
}
