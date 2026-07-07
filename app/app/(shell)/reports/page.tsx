import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
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
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, report_type, framework, generated_at, ai_executive_summary")
    .eq("practice_id", session.membership.practice_id)
    .order("generated_at", { ascending: false });

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Audit-ready exports"
        title="Reports"
        description="Point-in-time compliance reports with AI-written executive summaries. Each freezes current state so you can hand a clean document to auditors."
        action={<GenerateReportButton practiceId={session.membership.practice_id} />}
      />

      {!reports || reports.length === 0 ? (
        <EmptyState
          title="No reports generated yet"
          description="Click 'Generate report' above to produce your first executive summary from current posture."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {(reports as ReportRow[]).map((r) => (
              <Link key={r.id} href={`/app/reports/${r.id}`} className="block">
                <div className="px-5 py-4 hover:bg-[var(--color-surface-raised)] transition-colors">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <p className="text-[var(--color-primary)] font-medium text-sm capitalize">
                      {r.report_type.replace(/_/g, " ")}{r.framework ? ` · ${r.framework}` : ""}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)]">
                      {new Date(r.generated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {r.ai_executive_summary && (
                    <p className="text-sm text-[var(--color-tertiary)] line-clamp-2 max-w-3xl">
                      {r.ai_executive_summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
