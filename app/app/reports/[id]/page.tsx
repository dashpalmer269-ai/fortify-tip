import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface ReportRow {
  id: string;
  report_type: string;
  framework: string | null;
  generated_at: string;
  snapshot: {
    practice_name?: string;
    readiness?: Array<{ framework_code: string; weighted_pct: number; satisfied: number; total: number }>;
    critical_open?: number;
    recent_drift_alerts_30d?: number;
    vendors_missing_baa?: number;
  } | null;
  ai_executive_summary: string | null;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data } = await supabase
    .from("reports")
    .select("id, report_type, framework, generated_at, snapshot, ai_executive_summary")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as ReportRow;
  const snap = r.snapshot ?? {};

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <Link href="/app/reports" className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
        ← Back to reports
      </Link>

      <div className="mt-6 mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2 capitalize">
          {r.report_type.replace(/_/g, " ")}{r.framework ? ` · ${r.framework}` : ""}
        </p>
        <h1 className="font-display text-4xl text-[var(--color-primary)] leading-none mb-3" style={{ letterSpacing: "-0.025em" }}>
          {snap.practice_name ?? "Compliance report"}
        </h1>
        <p className="font-mono text-[11px] text-[var(--color-tertiary)]">
          Generated {new Date(r.generated_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      <section className="space-y-px">
        {r.ai_executive_summary ? (
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">
                Executive summary
              </p>
              <p className="text-[15px] text-[var(--color-primary)] leading-relaxed whitespace-pre-wrap">
                {r.ai_executive_summary}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-tertiary)]">AI executive summary not yet generated.</p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
              Per-framework posture
            </p>
            {snap.readiness && snap.readiness.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--color-border-subtle)] surface rounded-lg overflow-hidden">
                {snap.readiness.map((row) => (
                  <div key={row.framework_code} className="bg-[var(--color-canvas)] px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1">
                      {row.framework_code}
                    </p>
                    <p className="font-display text-2xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                      {Math.round(Number(row.weighted_pct) || 0)}%
                    </p>
                    <p className="font-mono text-[10px] text-[var(--color-quaternary)] mt-0.5 tabular-nums">
                      {row.satisfied} / {row.total}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-tertiary)]">No framework data captured.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <SnapStat label="Critical controls open" value={snap.critical_open ?? 0} hot={(snap.critical_open ?? 0) > 0} />
            <SnapStat label="Drift alerts (30d)" value={snap.recent_drift_alerts_30d ?? 0} hot={(snap.recent_drift_alerts_30d ?? 0) > 0} />
            <SnapStat label="BAAs missing" value={snap.vendors_missing_baa ?? 0} hot={(snap.vendors_missing_baa ?? 0) > 0} />
          </CardBody>
        </Card>
      </section>

      <div className="mt-6 px-4 py-3 surface rounded-md">
        <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
          <Badge variant="muted">Note</Badge> Native PDF export ships later. Use browser <kbd className="font-mono">Print → Save as PDF</kbd> for now.
        </p>
      </div>
    </div>
  );
}

function SnapStat({ label, value, hot }: { label: string; value: number; hot: boolean }) {
  const color = hot ? "var(--color-danger)" : "var(--color-success)";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1">{label}</p>
      <p className="font-display text-2xl tabular-nums" style={{ color, letterSpacing: "-0.02em" }}>
        {value}
      </p>
    </div>
  );
}
