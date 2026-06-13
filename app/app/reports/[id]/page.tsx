import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
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
    tasks_open?: number;
    tasks_overdue?: number;
    tasks_critical?: number;
    training_current?: number;
    training_expired?: number;
    screenings_total?: number;
    screenings_blocked?: number;
    screenings_stale?: number;
  } | null;
  ai_executive_summary: string | null;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession();
  assertActive(session);

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

        {/* Remediation workload */}
        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
              Open work
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <SnapStat label="Open tasks" value={snap.tasks_open ?? 0} hot={false} />
              <SnapStat label="Overdue tasks" value={snap.tasks_overdue ?? 0} hot={(snap.tasks_overdue ?? 0) > 0} />
              <SnapStat label="Critical tasks" value={snap.tasks_critical ?? 0} hot={(snap.tasks_critical ?? 0) > 0} />
            </div>
          </CardBody>
        </Card>

        {/* Workforce: training + screening */}
        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
              Workforce
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <SnapStat label="Training current" value={snap.training_current ?? 0} hot={false} />
              <SnapStat label="Training expired" value={snap.training_expired ?? 0} hot={(snap.training_expired ?? 0) > 0} />
              <SnapStat label="Screenings on file" value={snap.screenings_total ?? 0} hot={false} />
              <SnapStat label="Screenings blocked" value={snap.screenings_blocked ?? 0} hot={(snap.screenings_blocked ?? 0) > 0} />
              <SnapStat label="Screenings stale (30d+)" value={snap.screenings_stale ?? 0} hot={(snap.screenings_stale ?? 0) > 0} />
            </div>
          </CardBody>
        </Card>
      </section>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href={`/app/reports/${r.id}/print?autoprint=1`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover,#7c3aed)] text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </Link>
        <Link
          href={`/app/reports/${r.id}/print?autoprint=0`}
          target="_blank"
          rel="noopener"
          className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
        >
          Preview print view
        </Link>
        <span className="ml-auto text-[11px] text-[var(--color-quaternary)] font-mono">
          <Badge variant="muted">PDF</Badge> generated via browser print
        </span>
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
