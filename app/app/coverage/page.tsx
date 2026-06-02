import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import CoverageBrowser from "./CoverageBrowser";

export const dynamic = "force-dynamic";

/**
 * Framework coverage page — the inverse view of /app/compliance.
 * On /app/compliance you see "controls and which frameworks they satisfy."
 * Here you see "framework citations and which controls cover them."
 *
 * Source-defensible compliance posture: for every framework requirement,
 * the practice can answer "are we covered? by which control? compliant?"
 */
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ framework?: string; category?: string; status?: string }>;
}) {
  const session = await getAppSession();
  assertActive(session);
  const params = await searchParams;

  const supabase = await createAuthedServerClient();

  const [reqRes, mappingRes, pcRes] = await Promise.all([
    supabase
      .from("framework_requirements")
      .select(`
        id, citation, parent_citation, title, description, category,
        obligation_type, weight, source_url, source_type,
        frameworks(code, name)
      `)
      .returns<
        Array<{
          id: string;
          citation: string;
          parent_citation: string | null;
          title: string;
          description: string;
          category: string | null;
          obligation_type: "required" | "addressable" | "recommended" | null;
          weight: number | null;
          source_url: string | null;
          source_type: string | null;
          frameworks: { code: string; name: string } | null;
        }>
      >(),
    supabase
      .from("framework_mappings")
      .select(`
        framework_requirement_id, mapping_strength, mapping_confidence,
        interpretation_basis,
        controls(id, control_key, title, audience, default_weight)
      `)
      .returns<
        Array<{
          framework_requirement_id: string;
          mapping_strength: string | null;
          mapping_confidence: "high" | "medium" | "low";
          interpretation_basis: string | null;
          controls: {
            id: string;
            control_key: string;
            title: string;
            audience: string;
            default_weight: number;
          } | null;
        }>
      >(),
    supabase
      .from("practice_controls")
      .select("control_id, status")
      .eq("practice_id", session.membership.practice_id),
  ]);

  // Map control_id → status for this practice
  const statusByControl = new Map((pcRes.data ?? []).map((pc) => [pc.control_id, pc.status]));

  // Group mappings by framework_requirement_id
  type Coverage = {
    controlId: string;
    controlKey: string;
    controlTitle: string;
    controlWeight: number;
    audience: string;
    mappingStrength: string | null;
    mappingConfidence: "high" | "medium" | "low";
    basis: string | null;
    status: string;
  };
  const coverageByReq = new Map<string, Coverage[]>();
  for (const m of mappingRes.data ?? []) {
    if (!m.controls) continue;
    const cov: Coverage = {
      controlId: m.controls.id,
      controlKey: m.controls.control_key,
      controlTitle: m.controls.title,
      controlWeight: m.controls.default_weight,
      audience: m.controls.audience,
      mappingStrength: m.mapping_strength,
      mappingConfidence: m.mapping_confidence,
      basis: m.interpretation_basis,
      status: statusByControl.get(m.controls.id) ?? "not_started",
    };
    const existing = coverageByReq.get(m.framework_requirement_id) ?? [];
    existing.push(cov);
    coverageByReq.set(m.framework_requirement_id, existing);
  }

  // Build the requirement rows enriched with coverage status
  const enriched = (reqRes.data ?? [])
    .filter((r) => r.frameworks)
    .map((r) => {
      const coverages = coverageByReq.get(r.id) ?? [];
      // A requirement is "covered" when ≥1 mapped control is compliant.
      // "partially covered" when mapped but no compliant control.
      // "uncovered" when no mappings exist at all.
      const hasCompliant = coverages.some((c) => c.status === "compliant");
      const hasPartial = coverages.some((c) => c.status === "partial");
      const coverageStatus: "covered" | "partial" | "uncovered" | "unmapped" =
        coverages.length === 0
          ? "unmapped"
          : hasCompliant
          ? "covered"
          : hasPartial
          ? "partial"
          : "uncovered";
      return {
        id: r.id,
        framework: r.frameworks!.code,
        framework_name: r.frameworks!.name,
        citation: r.citation,
        parent_citation: r.parent_citation,
        title: r.title,
        description: r.description,
        category: r.category,
        obligation_type: r.obligation_type,
        weight: r.weight,
        source_url: r.source_url,
        source_type: r.source_type,
        coverage_status: coverageStatus,
        mapped_controls: coverages,
      };
    });

  return (
    <CoverageBrowser
      requirements={enriched}
      initialFramework={params.framework ?? null}
      initialCategory={params.category ?? null}
      initialStatus={params.status ?? null}
    />
  );
}
