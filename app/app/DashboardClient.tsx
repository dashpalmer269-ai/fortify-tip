"use client";
import Link from "next/link";

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

const FRAMEWORK_LABELS: Record<string, { name: string; color: string }> = {
  HIPAA: { name: "HIPAA", color: "#8b5cf6" },
  SOC2: { name: "SOC 2", color: "#3b82f6" },
  ISO27001: { name: "ISO 27001", color: "#10b981" },
  GDPR: { name: "GDPR", color: "#f97316" },
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
    <div className="px-8 py-8 max-w-6xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-gray-600 mb-1">Compliance dashboard</p>
        <h1 className="text-3xl font-bold text-white">{practiceName}</h1>
      </div>

      {/* Overall + critical strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          className="glass-card rounded-2xl p-6 col-span-1 md:col-span-2"
          style={{ boxShadow: "0 0 28px rgba(139,92,246,0.18)" }}
        >
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Overall audit readiness</p>
          <div className="flex items-end gap-4">
            <p
              className="text-5xl font-black text-white tabular-nums"
              style={{ textShadow: "0 0 20px rgba(139,92,246,0.6)" }}
            >
              {overallPct}%
            </p>
            <p className="text-sm text-gray-500 pb-2">
              weighted across {readiness.length} {readiness.length === 1 ? "framework" : "frameworks"}
            </p>
          </div>
          <div className="mt-4 h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(overallPct, 100)}%`,
                background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                boxShadow: "0 0 12px rgba(139,92,246,0.6)",
              }}
            />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Critical findings</p>
          <p
            className={`text-5xl font-black tabular-nums ${
              criticalCount > 0 ? "text-red-400" : "text-emerald-400"
            }`}
            style={{
              textShadow: criticalCount > 0 ? "0 0 18px rgba(239,68,68,0.5)" : "0 0 18px rgba(16,185,129,0.5)",
            }}
          >
            {criticalCount}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {criticalCount === 0
              ? "All critical controls compliant"
              : criticalCount === 1
              ? "Open critical issue"
              : "Open critical issues"}
          </p>
        </div>
      </div>

      {/* Per-framework scorecards */}
      <div className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">By framework</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {readiness.map((r) => {
            const meta = FRAMEWORK_LABELS[r.framework_code] ?? { name: r.framework_code, color: "#a78bfa" };
            const pct = Math.round(Number(r.weighted_pct) || 0);
            return (
              <Link
                key={r.framework_code}
                href={`/app/compliance?framework=${r.framework_code}`}
                className="glass-card rounded-xl p-5 hover:bg-white/[0.02] transition-colors block"
              >
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{meta.name}</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>
                  {pct}%
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {r.satisfied}/{r.total} requirements satisfied
                </p>
                <div className="mt-3 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: meta.color,
                      boxShadow: `0 0 8px ${meta.color}`,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/app/compliance"
            className="glass-card rounded-xl p-4 hover:bg-white/[0.02] transition-colors block"
          >
            <p className="text-sm font-medium text-white">Review controls</p>
            <p className="text-xs text-gray-500 mt-1">Mark compliant, upload evidence</p>
          </Link>
          <Link
            href="/app/vendors"
            className="glass-card rounded-xl p-4 hover:bg-white/[0.02] transition-colors block"
          >
            <p className="text-sm font-medium text-white">Vendors & BAAs</p>
            <p className="text-xs text-gray-500 mt-1">Track expirations, add new BAAs</p>
          </Link>
          <Link
            href="/app/threats"
            className="glass-card rounded-xl p-4 hover:bg-white/[0.02] transition-colors block"
          >
            <p className="text-sm font-medium text-white">Threat intelligence</p>
            <p className="text-xs text-gray-500 mt-1">Live CVE + breach feed</p>
          </Link>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-sm text-gray-500">
            No activity yet. As you and your team make changes, an audit trail will appear here.
          </div>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
            {recentActivity.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-white">{formatAction(a.action)}</p>
                  <p className="text-xs text-gray-600">
                    {a.actor_service ? `system · ${a.actor_service}` : "user action"} ·{" "}
                    {new Date(a.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gray-600 shrink-0">
                  {a.resource_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAction(a: string): string {
  return a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
