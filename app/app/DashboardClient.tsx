"use client";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

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
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  actor_service: string | null;
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
}: {
  practiceName: string;
  readiness: ReadinessRow[];
  criticalCount: number;
  recentActivity: ActivityRow[];
}) {
  const overallPct =
    readiness.length > 0
      ? Math.round(
          readiness.reduce((s, r) => s + (Number(r.weighted_pct) || 0), 0) / readiness.length
        )
      : 0;

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow={practiceName}
        title="Audit readiness"
        description="A live view of how your controls map across every enabled framework. Marking one control compliant updates every framework score it satisfies."
      />

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
                    {new Date(a.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
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
