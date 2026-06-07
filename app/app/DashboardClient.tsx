"use client";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import TaskList, { type TaskItem } from "@/components/app/TaskList";

interface ReadinessRow {
  framework_code: string;
  weighted_pct: number | null;
  satisfied: number;
  total: number;
}

interface ActivityRow {
  id: string;
  action: string;
  resource_type: string;
  metadata: unknown;
  occurred_at: string | null;
  actor_service: string | null;
}

interface ReadinessSignals {
  open_critical_tasks: number;
  overdue_tasks: number;
  expired_baas: number;
  stale_screenings: number;
  drift_alerts_open: number;
}

const FRAMEWORK_META: Record<string, { name: string; tone: string }> = {
  HIPAA:    { name: "HIPAA Security Rule",     tone: "var(--color-fw-hipaa)" },
  SOC2:     { name: "SOC 2 Trust Services",    tone: "var(--color-fw-soc2)" },
  ISO27001: { name: "ISO/IEC 27001:2022",      tone: "var(--color-fw-iso)" },
  GDPR:     { name: "GDPR Article 32",         tone: "var(--color-fw-gdpr)" },
};

export default function DashboardClient({
  practiceName,
  readiness,
  criticalCount,
  recentActivity,
  narrative,
  tasks,
  readinessSignals,
}: {
  practiceName: string;
  readiness: ReadinessRow[];
  criticalCount: number;
  recentActivity: ActivityRow[];
  narrative?: string | null;
  tasks?: TaskItem[];
  /**
   * Practice-wide risk signals from audit_readiness_v2. Optional so any
   * older caller of DashboardClient continues to render — those just don't
   * see the v2 signal strip.
   */
  readinessSignals?: ReadinessSignals;
}) {
  const overallPct =
    readiness.length > 0
      ? Math.round(
          readiness.reduce((s, r) => s + (Number(r.weighted_pct) || 0), 0) / readiness.length
        )
      : 0;
  const punchList = tasks ?? [];

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow={practiceName}
        title="Audit readiness"
        description="A live view of how your controls map across every enabled framework. Marking one control compliant updates every framework score it satisfies."
      />

      {/* The "practice in a sentence" — AI narrative from your dedicated compliance officer */}
      {narrative && (
        <Card variant="raised" className="mb-6">
          <div className="px-6 py-5 flex items-start gap-4">
            <div
              className="mt-0.5 w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(167,139,250,0.4)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-1.5">
                From your compliance officer
              </p>
              <p className="text-[15px] text-[var(--color-primary)] leading-[1.65]">{narrative}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Hero stats — two columns: overall + critical findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <Card className="lg:col-span-2 p-8 ">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-4">
            Weighted across {readiness.length} {readiness.length === 1 ? "framework" : "frameworks"}
          </p>
          <div className="flex items-baseline gap-2 mb-6">
            <span
              className="font-display text-[var(--text-display-1)] leading-none text-[var(--color-primary)] tabular-nums"
              style={{ letterSpacing: "-0.04em" }}
            >
              {overallPct}
            </span>
            <span className="font-display text-3xl text-[var(--color-tertiary)]">%</span>
          </div>
          <ProgressBar pct={overallPct} tone="var(--color-primary)" />
        </Card>

        <Card className="p-8 " variant={criticalCount > 0 ? "raised" : "default"}>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-4">
            Critical findings
          </p>
          <p
            className={`font-display text-[var(--text-display-2)] leading-none tabular-nums ${
              criticalCount > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"
            }`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {criticalCount}
          </p>
          <p className="text-sm text-[var(--color-tertiary)] mt-3 leading-snug">
            {criticalCount === 0
              ? "All critical controls compliant."
              : criticalCount === 1
              ? "Open critical issue."
              : "Open critical issues."}
          </p>
          {criticalCount > 0 && (
            <Link
              href="/app/compliance?status=non_compliant"
              className="inline-block mt-4 text-[12px] text-[var(--color-accent)] hover:underline"
            >
              Review →
            </Link>
          )}
        </Card>
      </div>

      {/* v2 risk signals — a single strip of small at-a-glance cards
          showing the practice-wide totals returned by audit_readiness_v2.
          Renders only when readinessSignals is supplied AND at least one
          signal is non-zero (otherwise it's noise). */}
      {readinessSignals && hasAnySignal(readinessSignals) && (
        <section className="mb-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SignalCard
            label="Overdue tasks"
            value={readinessSignals.overdue_tasks}
            href="/app/tasks?filter=overdue"
            tone={readinessSignals.overdue_tasks > 0 ? "danger" : "neutral"}
          />
          <SignalCard
            label="Critical tasks open"
            value={readinessSignals.open_critical_tasks}
            href="/app/tasks?severity=critical"
            tone={readinessSignals.open_critical_tasks > 0 ? "warn" : "neutral"}
          />
          <SignalCard
            label="Expired BAAs"
            value={readinessSignals.expired_baas}
            href="/app/vendors?filter=expired"
            tone={readinessSignals.expired_baas > 0 ? "warn" : "neutral"}
          />
          <SignalCard
            label="Stale screenings"
            value={readinessSignals.stale_screenings}
            href="/app/team"
            tone={readinessSignals.stale_screenings > 0 ? "warn" : "neutral"}
          />
          <SignalCard
            label="Drift alerts open"
            value={readinessSignals.drift_alerts_open}
            href="/app/threats"
            tone={readinessSignals.drift_alerts_open > 0 ? "warn" : "neutral"}
          />
        </section>
      )}

      {/* Per-framework scorecards */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.02em" }}>
            By framework
          </h2>
          <Link href="/app/compliance" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-tertiary)] hover:text-[var(--color-primary)]">
            All controls →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {readiness.map((r) => {
            const meta = FRAMEWORK_META[r.framework_code] ?? { name: r.framework_code, tone: "var(--color-accent)" };
            const pct = Math.round(Number(r.weighted_pct) || 0);
            return (
              <Link key={r.framework_code} href={`/app/compliance?framework=${r.framework_code}`}>
                <Card variant="interactive" className="p-5 h-full">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-3">
                    {r.framework_code}
                  </p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-display text-3xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.03em" }}>
                      {pct}
                    </span>
                    <span className="text-[var(--color-tertiary)]">%</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-quaternary)] tabular-nums mb-3">
                    {r.satisfied} of {r.total} satisfied
                  </p>
                  <ProgressBar pct={pct} tone={meta.tone} thin />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Who needs to do what — the prioritized punch list */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.02em" }}>
            Who needs to do what
          </h2>
          {punchList.length > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-tertiary)]">
              {punchList.length} open
            </span>
          )}
        </div>
        <TaskList
          tasks={punchList}
          showAssignee
          emptyMessage="No open tasks. Every control with evidence is satisfied."
        />
      </section>

      {/* Quick actions */}
      <section className="mb-10">
        <h2 className="font-display text-xl text-[var(--color-primary)] mb-4" style={{ letterSpacing: "-0.02em" }}>
          Move the needle
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction href="/app/risk-assessment/new" label="Run risk assessment" hint="5 min · AI executive summary" />
          <QuickAction href="/app/vendors" label="Add a vendor" hint="Track BAA status" />
          <QuickAction href="/app/reports" label="Generate report" hint="Auditor-ready snapshot" />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="font-display text-xl text-[var(--color-primary)] mb-4" style={{ letterSpacing: "-0.02em" }}>
          Activity
        </h2>
        {recentActivity.length === 0 ? (
          <Card className="py-12 px-6 text-center">
            <p className="text-sm text-[var(--color-tertiary)]">
              No activity yet. Every change you and your team make appears here for SOC 2 evidence.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--color-border-subtle)] overflow-hidden">
            {recentActivity.map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-primary)]">{formatAction(a.action)}</p>
                  <p className="text-[11px] text-[var(--color-quaternary)] font-mono mt-0.5">
                    {a.actor_service ? `system · ${a.actor_service}` : "user action"} ·{" "}
                    {a.occurred_at ? new Date(a.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </p>
                </div>
                <Badge variant="muted">{a.resource_type.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/* ── Local components ─────────────────────────────────────────── */

function ProgressBar({ pct, tone, thin = false }: { pct: number; tone: string; thin?: boolean }) {
  return (
    <div
      className={`bg-[var(--color-border-subtle)] rounded-full overflow-hidden ${thin ? "h-1" : "h-1.5"}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: tone }}
      />
    </div>
  );
}

function QuickAction({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href}>
      <Card variant="interactive" className="p-5 h-full">
        <p className="text-[var(--color-primary)] text-sm font-medium mb-1">{label} →</p>
        <p className="text-xs text-[var(--color-tertiary)]">{hint}</p>
      </Card>
    </Link>
  );
}

function formatAction(a: string): string {
  return a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function hasAnySignal(s: ReadinessSignals): boolean {
  return (
    s.overdue_tasks > 0 ||
    s.open_critical_tasks > 0 ||
    s.expired_baas > 0 ||
    s.stale_screenings > 0 ||
    s.drift_alerts_open > 0
  );
}

function SignalCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "neutral" | "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
      ? "var(--color-warn, #d97706)"
      : "var(--color-secondary)";
  return (
    <Link href={href}>
      <Card variant="interactive" className="p-4 h-full">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-2">
          {label}
        </p>
        <p
          className="font-display text-2xl leading-none tabular-nums"
          style={{ color: value > 0 ? color : "var(--color-tertiary)", letterSpacing: "-0.03em" }}
        >
          {value}
        </p>
      </Card>
    </Link>
  );
}
