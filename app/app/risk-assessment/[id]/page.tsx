import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<string, string> = {
  low:      "var(--color-success)",
  medium:   "var(--color-warning)",
  high:     "var(--color-danger)",
  critical: "var(--color-danger)",
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
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const { data } = await supabase
    .from("risk_assessments")
    .select("id, framework, assessment_date, status, answers, risk_score, risk_level, ai_executive_summary, ai_remediation_plan")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as AssessmentRow;
  const tone = LEVEL_TONE[a.risk_level ?? "low"] ?? LEVEL_TONE.low;
  const levelVariant = a.risk_level === "low" ? "success" : a.risk_level === "medium" ? "warning" : "danger";

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <Link href="/app/risk-assessment" className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
        ← Back to risk
      </Link>

      <div className="mt-6 mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2">
          {a.framework} · {a.status}
        </p>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-display text-4xl text-[var(--color-primary)] leading-none" style={{ letterSpacing: "-0.025em" }}>
            {new Date(a.assessment_date).toLocaleDateString("en-US", { dateStyle: "long" })}
          </h1>
          {a.risk_score != null && (
            <div className="text-right">
              <p className="font-display text-5xl tabular-nums leading-none" style={{ color: tone, letterSpacing: "-0.03em" }}>
                {a.risk_score}
              </p>
              {a.risk_level && (
                <div className="mt-2 flex justify-end">
                  <Badge variant={levelVariant as "success" | "warning" | "danger"}>
                    {a.risk_level} risk
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-px mb-px">
        {a.ai_executive_summary ? (
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">
                Executive summary
              </p>
              <p className="text-[15px] text-[var(--color-primary)] leading-relaxed whitespace-pre-wrap">
                {a.ai_executive_summary}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-tertiary)]">AI executive summary not generated. Assessment saved as draft.</p>
            </CardBody>
          </Card>
        )}

        {a.ai_remediation_plan && (
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">
                Recommended remediation
              </p>
              <p className="text-[15px] text-[var(--color-secondary)] leading-relaxed whitespace-pre-wrap">
                {a.ai_remediation_plan}
              </p>
            </CardBody>
          </Card>
        )}

        {a.answers && (
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
                Your answers
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0">
                {Object.entries(a.answers).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2 text-sm border-b border-[var(--color-border-subtle)]">
                    <dt className="text-[var(--color-tertiary)] capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-[var(--color-primary)] text-right font-mono text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
