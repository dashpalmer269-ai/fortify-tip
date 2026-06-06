import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Status — Fortify",
  description: "Live operational status of Fortify's evidence pipeline, crons, and integrations.",
};

/**
 * Public status page. Renders aggregate health of the evidence pipeline,
 * cron jobs, and integration scans without exposing per-practice data.
 *
 * Data sources (read-only, aggregated):
 *   - drift_alerts unack'd in last 24h    → pipeline health
 *   - practice_evidence collected in last 24h → ingestion volume
 *   - integration rows in 'error' state    → provider connectivity
 *   - audit_logs of recent cron runs       → cron operation
 *
 * No tenant data, no PHI, no per-customer detail. Anonymous read.
 */
export default async function StatusPage() {
  const db = createServerClient();

  const health: {
    label: string;
    state: "operational" | "degraded" | "unknown";
    detail: string;
  }[] = [];

  if (!db) {
    health.push({ label: "Platform", state: "degraded", detail: "Service client unavailable" });
  } else {
    // Server component renders once per request; Date.now is acceptable.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const since = new Date(now - day).toISOString();

    // Evidence pipeline: count of evidence rows collected in the last 24h
    const { count: evidenceCount } = await db
      .from("practice_evidence")
      .select("*", { count: "exact", head: true })
      .gte("collected_at", since);
    health.push({
      label: "Evidence pipeline",
      state: (evidenceCount ?? 0) > 0 ? "operational" : "unknown",
      detail: `${evidenceCount ?? 0} evidence rows collected in last 24h`,
    });

    // Cron health: any verify-compliance audit-log entry in last 24h
    const { count: cronEvidenceLogs } = await db
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("action", "evidence.collected")
      .gte("occurred_at", since);
    health.push({
      label: "Verify-compliance cron",
      state: (cronEvidenceLogs ?? 0) > 0 ? "operational" : "unknown",
      detail: `${cronEvidenceLogs ?? 0} cron-triggered evidence events in last 24h`,
    });

    // Drift detection: open drift alerts (aggregate, no practice info)
    const { count: openDrift } = await db
      .from("drift_alerts")
      .select("*", { count: "exact", head: true })
      .is("acknowledged_at", null)
      .gte("detected_at", since);
    health.push({
      label: "Drift detection",
      state: "operational",
      detail: `${openDrift ?? 0} unacknowledged drift alerts (last 24h, aggregate)`,
    });

    // Integration health: aggregate count of integrations in 'error' state
    const { count: integrationsErrored } = await db
      .from("integrations")
      .select("*", { count: "exact", head: true })
      .eq("status", "error");
    health.push({
      label: "Integration connections",
      state: (integrationsErrored ?? 0) === 0 ? "operational" : "degraded",
      detail:
        (integrationsErrored ?? 0) === 0
          ? "All integration credentials resolving cleanly"
          : `${integrationsErrored} integration(s) currently in error state`,
    });
  }

  const checkedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const allOk = health.every((h) => h.state === "operational" || h.state === "unknown");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-violet-400 mb-2">Status</p>
        <h1 className="text-3xl font-bold mb-2">Fortify operational health</h1>
        <p className="text-sm text-gray-400 mb-8">
          Live aggregate health of the evidence pipeline, crons, and integration layer.
          Updated every minute. No tenant data is shown on this page.
        </p>

        <div
          className={`rounded-xl px-5 py-4 mb-6 border ${
            allOk ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"
          }`}
        >
          <p className={`text-sm font-medium ${allOk ? "text-emerald-300" : "text-amber-300"}`}>
            {allOk ? "All systems operational" : "Some systems degraded"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Checked {checkedAt}</p>
        </div>

        <div className="space-y-2">
          {health.map((h) => (
            <div key={h.label} className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">{h.label}</span>
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] font-mono ${
                    h.state === "operational" ? "text-emerald-400"
                    : h.state === "degraded" ? "text-amber-400"
                    : "text-gray-500"
                  }`}
                >
                  {h.state}
                </span>
              </div>
              <p className="text-xs text-gray-500">{h.detail}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600 mt-10 leading-relaxed">
          Incident reports are posted to <a href="mailto:status@fortifynow.xyz" className="text-violet-400 hover:text-white">status@fortifynow.xyz</a> within 30 minutes of detection.
          Architecture review available at <a href="/architecture" className="text-violet-400 hover:text-white">/architecture</a>.
        </p>
      </div>
    </div>
  );
}
