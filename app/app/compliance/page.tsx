import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import ComplianceBrowser from "./ComplianceBrowser";

export const dynamic = "force-dynamic";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{
    framework?: string;
    category?: string;
    healthcare_category?: string;
    audience?: string;
    status?: string;
  }>;
}) {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const params = await searchParams;

  const [controlsRes, practiceControlsRes] = await Promise.all([
    supabase
      .from("controls")
      .select(`
        id, control_key, title, description, category, implementation_type,
        default_priority, healthcare_baseline,
        healthcare_category, audience, automation_status,
        evidence_summary, remediation_guide, report_output_text,
        framework_mappings(framework_requirements(framework_id, frameworks(code)))
      `)
      .eq("active", true)
      .order("default_priority", { ascending: true })
      .order("category", { ascending: true }),
    supabase
      .from("practice_controls")
      .select("control_id, status, last_verified_at, implementation_notes")
      .eq("practice_id", session.membership.practice_id),
  ]);

  const statusByControlId = new Map(
    (practiceControlsRes.data ?? []).map((pc) => [pc.control_id, pc])
  );

  const enriched = (controlsRes.data ?? []).map((c) => {
    type MappingShape = { framework_requirements: { frameworks: { code: string } } | null };
    const mappings = (c.framework_mappings ?? []) as unknown as MappingShape[];
    const frameworkCodes = Array.from(
      new Set(mappings.map((m) => m.framework_requirements?.frameworks?.code).filter(Boolean))
    ) as string[];
    const pc = statusByControlId.get(c.id) ?? null;
    return {
      id: c.id,
      control_key: c.control_key,
      title: c.title,
      description: c.description,
      category: c.category,
      implementation_type: c.implementation_type,
      default_priority: c.default_priority,
      healthcare_baseline: c.healthcare_baseline,
      healthcare_category: c.healthcare_category,
      audience: c.audience,
      automation_status: c.automation_status,
      evidence_summary: c.evidence_summary,
      remediation_guide: c.remediation_guide,
      report_output_text: c.report_output_text,
      frameworks: frameworkCodes,
      mapping_count: mappings.length,
      status: pc?.status ?? "not_started",
      last_verified_at: pc?.last_verified_at ?? null,
      implementation_notes: pc?.implementation_notes ?? null,
    };
  });

  return (
    <ComplianceBrowser
      practiceId={session.membership.practice_id}
      controls={enriched}
      initialFramework={params.framework ?? null}
      initialCategory={params.category ?? null}
      initialHealthcareCategory={params.healthcare_category ?? null}
      initialAudience={params.audience ?? null}
      initialStatus={params.status ?? null}
    />
  );
}
