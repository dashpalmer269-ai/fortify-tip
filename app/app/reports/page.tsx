import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import GenerateReportButton from "./GenerateReportButton";

export const dynamic = "force-dynamic";

interface ReportRow {
  id: string;
  report_type: string;
  framework: string | null;
  generated_at: string;
  ai_executive_summary: string | null;
}

export default async function ReportsPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, report_type, framework, generated_at, ai_executive_summary")
    .eq("practice_id", session.membership.practice_id)
    .order("generated_at", { ascending: false });

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Audit-ready exports</p>
          <h1 className="text-3xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            Generate point-in-time compliance reports with AI-written executive summaries. Each report freezes the current state so you can hand a clean document to auditors.
          </p>
        </div>
        <GenerateReportButton practiceId={session.membership.practice_id} />
      </div>

      {(!reports || reports.length === 0) ? (
        <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
          No reports generated yet. Click <span className="text-white">Generate report</span> above to produce your first executive summary.
        </div>
      ) : (
        <div className="space-y-3">
          {(reports as ReportRow[]).map((r) => (
            <Link
              key={r.id}
              href={`/app/reports/${r.id}`}
              className="glass-card rounded-xl p-5 hover:bg-white/[0.02] transition-colors block"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <p className="text-white font-medium capitalize">
                    {r.report_type.replace(/_/g, " ")} {r.framework ? `· ${r.framework}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(r.generated_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                </div>
                <span className="text-xs text-violet-300">View →</span>
              </div>
              {r.ai_executive_summary && (
                <p className="text-sm text-gray-400 line-clamp-2">{r.ai_executive_summary}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
