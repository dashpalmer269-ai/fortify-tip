import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

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
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/app/reports" className="text-xs text-gray-500 hover:text-white">
          ← Back to reports
        </Link>
      </div>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 mb-6" style={{ boxShadow: "0 0 24px rgba(139,92,246,0.2)" }}>
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">
          {r.report_type.replace(/_/g, " ")} {r.framework ? `· ${r.framework}` : ""}
        </p>
        <h1 className="text-3xl font-bold text-white">{snap.practice_name ?? "Compliance report"}</h1>
        <p className="text-sm text-gray-500 mt-2">
          Generated {new Date(r.generated_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      {/* Executive summary */}
      {r.ai_executive_summary ? (
        <section className="glass-card rounded-2xl p-6 mb-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Executive summary</p>
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{r.ai_executive_summary}</p>
        </section>
      ) : (
        <section className="glass-card rounded-2xl p-6 mb-4 text-sm text-gray-500">
          AI executive summary not yet generated.
        </section>
      )}

      {/* Snapshot data */}
      <section className="glass-card rounded-2xl p-6 mb-4">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">Per-framework posture (snapshot at generation)</p>
        {snap.readiness && snap.readiness.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {snap.readiness.map((r) => (
              <div key={r.framework_code} className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-wider text-gray-500">{r.framework_code}</p>
                <p className="text-2xl font-black text-white mt-1">{Math.round(Number(r.weighted_pct) || 0)}%</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  {r.satisfied}/{r.total}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No framework data captured.</p>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SnapStat label="Critical controls open" value={snap.critical_open ?? 0} accent={(snap.critical_open ?? 0) > 0 ? "red" : "green"} />
        <SnapStat label="Drift alerts (30d)" value={snap.recent_drift_alerts_30d ?? 0} accent={(snap.recent_drift_alerts_30d ?? 0) > 0 ? "orange" : "green"} />
        <SnapStat label="BAAs missing" value={snap.vendors_missing_baa ?? 0} accent={(snap.vendors_missing_baa ?? 0) > 0 ? "red" : "green"} />
      </section>

      <div className="mt-6 rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs text-gray-500">
        PDF export lands once we wire a PDF renderer in Phase G. For now, print this page to PDF via your browser to deliver to an auditor.
      </div>
    </div>
  );
}

function SnapStat({ label, value, accent }: { label: string; value: number; accent: "red" | "orange" | "green" }) {
  const color = accent === "red" ? "#ef4444" : accent === "orange" ? "#f97316" : "#10b981";
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
