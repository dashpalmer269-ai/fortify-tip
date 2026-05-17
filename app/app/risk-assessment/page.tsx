import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

interface AssessmentRow {
  id: string;
  framework: string;
  assessment_date: string;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  ai_executive_summary: string | null;
}

const LEVEL_META: Record<string, { color: string; bg: string }> = {
  low:      { color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.18)" },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.2)" },
};

export default async function RiskAssessmentIndex() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: assessments } = await supabase
    .from("risk_assessments")
    .select("id, framework, assessment_date, status, risk_score, risk_level, ai_executive_summary")
    .eq("practice_id", session.membership.practice_id)
    .order("assessment_date", { ascending: false });

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Annual obligation</p>
          <h1 className="text-3xl font-bold text-white">Risk assessment</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            HIPAA §164.308(a)(1)(ii)(A) requires a documented risk analysis. Fortify guides you through a structured questionnaire and generates the auditor-ready executive summary in minutes.
          </p>
        </div>
        <Link
          href="/app/risk-assessment/new"
          className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          style={{ boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
        >
          + Start new assessment
        </Link>
      </div>

      {(!assessments || assessments.length === 0) ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-gray-300 text-sm mb-3">No assessments completed yet.</p>
          <p className="text-xs text-gray-500 mb-6 max-w-md mx-auto">
            We recommend completing a risk assessment at least annually and after any major change to your environment.
          </p>
          <Link
            href="/app/risk-assessment/new"
            className="inline-block bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Start your first assessment →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(assessments as AssessmentRow[]).map((a) => {
            const meta = LEVEL_META[a.risk_level ?? "low"] ?? LEVEL_META.low;
            return (
              <Link
                key={a.id}
                href={`/app/risk-assessment/${a.id}`}
                className="glass-card rounded-xl p-5 block hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{a.framework} risk assessment</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(a.assessment_date).toLocaleDateString("en-US", { dateStyle: "long" })} ·{" "}
                      <span className="capitalize">{a.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {a.risk_score != null && (
                      <div className="text-right">
                        <p className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>
                          {a.risk_score}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">risk score</p>
                      </div>
                    )}
                    {a.risk_level && (
                      <span
                        className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider"
                        style={{ color: meta.color, background: meta.bg }}
                      >
                        {a.risk_level}
                      </span>
                    )}
                  </div>
                </div>
                {a.ai_executive_summary && (
                  <p className="text-sm text-gray-400 mt-3 line-clamp-2">{a.ai_executive_summary}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
