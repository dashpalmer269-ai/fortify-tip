import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

const LEVEL_META: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "Low risk" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.15)", label: "Medium risk" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.18)", label: "High risk" },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.2)", label: "Critical risk" },
};

interface AssessmentRow {
  id: string;
  framework: string;
  assessment_date: string;
  status: string;
  answers: Record<string, string> | null;
  risk_score: number | null;
  risk_level: string | null;
  ai_executive_summary: string | null;
  ai_remediation_plan: string | null;
}

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data, error } = await supabase
    .from("risk_assessments")
    .select("id, framework, assessment_date, status, answers, risk_score, risk_level, ai_executive_summary, ai_remediation_plan")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (error || !data) notFound();
  const a = data as AssessmentRow;
  const meta = LEVEL_META[a.risk_level ?? "low"] ?? LEVEL_META.low;

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/app/risk-assessment" className="text-xs text-gray-500 hover:text-white">
          ← Back to risk assessments
        </Link>
      </div>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 mb-6" style={{ boxShadow: `0 0 28px ${meta.color}20` }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">
              {a.framework} risk assessment
            </p>
            <h1 className="text-3xl font-bold text-white">
              {new Date(a.assessment_date).toLocaleDateString("en-US", { dateStyle: "long" })}
            </h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">{a.status}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black tabular-nums" style={{ color: meta.color }}>
              {a.risk_score ?? "—"}
            </p>
            <span
              className="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider"
              style={{ color: meta.color, background: meta.bg }}
            >
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Executive summary */}
      {a.ai_executive_summary ? (
        <section className="glass-card rounded-2xl p-6 mb-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Executive summary</p>
          <div className="prose-invert text-gray-200 leading-relaxed whitespace-pre-wrap">
            {a.ai_executive_summary}
          </div>
        </section>
      ) : (
        <section className="glass-card rounded-2xl p-6 mb-4 text-sm text-gray-500">
          AI executive summary not generated. The assessment is saved as a draft.
        </section>
      )}

      {/* Remediation plan */}
      {a.ai_remediation_plan && (
        <section className="glass-card rounded-2xl p-6 mb-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Recommended remediation plan</p>
          <div className="prose-invert text-gray-200 leading-relaxed whitespace-pre-wrap">
            {a.ai_remediation_plan}
          </div>
        </section>
      )}

      {/* Raw answers */}
      {a.answers && (
        <section className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Your answers</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(a.answers).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</dt>
                <dd className="text-white text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
