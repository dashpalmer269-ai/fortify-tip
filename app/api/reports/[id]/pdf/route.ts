import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { buildReportPdf, type ReportPdfInput } from "@/lib/pdf/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Native PDF download for an audit-readiness report. Server-generated with
 * pdf-lib so every download is byte-consistent — no browser print dialog.
 * Auth mirrors the report page: session user, practice-scoped query.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice" }, { status: 403 });

  const { data: report } = await supabase
    .from("reports")
    .select("id, report_type, framework, generated_at, snapshot, ai_executive_summary")
    .eq("id", id)
    .eq("practice_id", membership.practice_id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const pdf = await buildReportPdf(report as unknown as ReportPdfInput);
  const generatedDate = new Date(report.generated_at ?? Date.now()).toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fortify-report-${generatedDate}-${report.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
