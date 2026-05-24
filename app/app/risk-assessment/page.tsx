import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

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

const LEVEL_TONE: Record<string, string> = {
  low:      "var(--color-success)",
  medium:   "var(--color-warning)",
  high:     "var(--color-danger)",
  critical: "var(--color-danger)",
};

export default async function RiskAssessmentIndex() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding");

  const supabase = await createAuthedServerClient();
  const { data: assessments } = await supabase
    .from("risk_assessments")
    .select("id, framework, assessment_date, status, risk_score, risk_level, ai_executive_summary")
    .eq("practice_id", session.membership.practice_id)
    .order("assessment_date", { ascending: false });

  const action = (
    <ButtonLink href="/app/risk-assessment/new" variant="primary" size="md">
      New assessment
    </ButtonLink>
  );

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Annual obligation"
        title="Risk"
        description="HIPAA §164.308(a)(1)(ii)(A) requires a documented risk analysis. Fortify guides the questionnaire and produces the auditor-ready executive summary."
        action={assessments && assessments.length > 0 ? action : undefined}
      />

      {!assessments || assessments.length === 0 ? (
        <EmptyState
          title="No risk assessment on file yet"
          description="We recommend completing one at least annually, and after any major change to your environment. The wizard takes about five minutes."
          action={<ButtonLink href="/app/risk-assessment/new" variant="primary" size="md">Start the wizard</ButtonLink>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {(assessments as AssessmentRow[]).map((a) => {
              const tone = LEVEL_TONE[a.risk_level ?? "low"] ?? LEVEL_TONE.low;
              return (
                <Link key={a.id} href={`/app/risk-assessment/${a.id}`} className="block">
                  <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-[var(--color-surface-raised)] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--color-primary)]">{a.framework} risk assessment</p>
                      <p className="font-mono text-[11px] text-[var(--color-tertiary)] mt-0.5">
                        {new Date(a.assessment_date).toLocaleDateString("en-US", { dateStyle: "long" })} ·{" "}
                        <span className="capitalize">{a.status}</span>
                      </p>
                      {a.ai_executive_summary && (
                        <p className="text-sm text-[var(--color-tertiary)] mt-2 line-clamp-2 max-w-2xl">
                          {a.ai_executive_summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {a.risk_score != null && (
                        <div className="text-right">
                          <p className="font-display text-2xl tabular-nums" style={{ color: tone, letterSpacing: "-0.02em" }}>
                            {a.risk_score}
                          </p>
                          <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-quaternary)]">
                            risk score
                          </p>
                        </div>
                      )}
                      {a.risk_level && (
                        <Badge variant={a.risk_level === "low" ? "success" : a.risk_level === "medium" ? "warning" : "danger"}>
                          {a.risk_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
