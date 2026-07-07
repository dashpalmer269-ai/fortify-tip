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
    role?: string;
  }>;
}) {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const params = await searchParams;

  const [controlsRes, practiceControlsRes, evidenceChecksRes, latestEvidenceRes] = await Promise.all([
    supabase
      .from("controls")
      .select(`
        id, control_key, title, description, category, implementation_type,
        default_priority, healthcare_baseline,
        healthcare_category, audience, automation_status, automation_level,
        evidence_summary, remediation_guide, report_output_text,
        default_weight, responsible_role,
        framework_mappings(
          mapping_strength, mapping_confidence, interpretation_basis,
          framework_requirements(citation, title, source_url, framework_id, frameworks(code))
        )
      `)
      .eq("active", true)
      .order("default_weight", { ascending: false })
      .order("default_priority", { ascending: true })
      .order("category", { ascending: true }),
    supabase
      .from("practice_controls")
      .select("control_id, status, last_verified_at, implementation_notes")
      .eq("practice_id", session.membership.practice_id),
    supabase
      .from("evidence_checks")
      .select(
        "id, control_id, check_key, collection_method, automation_level, evidence_required, manual_upload_allowed, attestation_acceptable, frequency_hours"
      ),
    supabase
      .from("practice_evidence")
      .select("evidence_check_id, status, collected_at, evidence_file_url")
      .eq("practice_id", session.membership.practice_id)
      .eq("is_current", true),
  ]);

  const statusByControlId = new Map(
    (practiceControlsRes.data ?? []).map((pc) => [pc.control_id, pc])
  );
  interface CheckShape {
    id: string;
    control_id: string;
    check_key: string;
    collection_method: string;
    automation_level: string | null;
    evidence_required: boolean | null;
    manual_upload_allowed: boolean | null;
    attestation_acceptable: boolean | null;
    frequency_hours: number | null;
  }
  const checksByControlId = new Map<string, CheckShape[]>();
  for (const ec of (evidenceChecksRes.data ?? []) as unknown as CheckShape[]) {
    if (!checksByControlId.has(ec.control_id)) checksByControlId.set(ec.control_id, []);
    checksByControlId.get(ec.control_id)!.push(ec);
  }
  const latestByCheckId = new Map(
    (latestEvidenceRes.data ?? []).map((e) => [e.evidence_check_id, e])
  );

  const enriched = (controlsRes.data ?? []).map((c) => {
    type MappingShape = {
      mapping_strength: string | null;
      mapping_confidence: "high" | "medium" | "low";
      interpretation_basis: string | null;
      framework_requirements: {
        citation: string;
        title: string;
        source_url: string | null;
        frameworks: { code: string } | null;
      } | null;
    };
    const mappings = (c.framework_mappings ?? []) as unknown as MappingShape[];
    const frameworkCodes = Array.from(
      new Set(mappings.map((m) => m.framework_requirements?.frameworks?.code).filter(Boolean))
    ) as string[];
    const mappingDetails = mappings
      .map((m) => ({
        framework: m.framework_requirements?.frameworks?.code ?? "",
        citation: m.framework_requirements?.citation ?? "",
        title: m.framework_requirements?.title ?? "",
        source_url: m.framework_requirements?.source_url ?? null,
        strength: m.mapping_strength,
        confidence: m.mapping_confidence,
        basis: m.interpretation_basis,
      }))
      .filter((m) => m.framework && m.citation);
    const pc = statusByControlId.get(c.id) ?? null;
    const checks = checksByControlId.get(c.id) ?? [];
    // Primary check = first check whose collection_method matches the control's
    // automation_status (so document_upload controls get their document check, etc.).
    const primaryCheck =
      checks.find((ec) => ec.collection_method === c.automation_status) ?? checks[0] ?? null;
    const latestEvidence = primaryCheck ? latestByCheckId.get(primaryCheck.id) ?? null : null;

    // ── Evidence guidance (#3): for this control, what's possible + current?
    // Roll up across all checks so a control with any auto-verifiable check
    // shows "auto-verify available", etc.
    const anyAuto = checks.some(
      (ec) => ec.automation_level === "auto_verified" || ec.automation_level === "partially_verified"
    );
    const anyUpload = checks.some(
      (ec) => ec.manual_upload_allowed === true || ec.collection_method === "document_upload"
    );
    const anyAttest = checks.some(
      (ec) =>
        ec.attestation_acceptable === true ||
        ec.collection_method === "manual_attestation" ||
        ec.automation_level === "admin_attestation"
    );
    const required = checks.length === 0 ? true : checks.some((ec) => ec.evidence_required !== false);
    // Currency: based on the freshest current-evidence collected_at vs the
    // tightest check frequency (×3 = stale, matching the readiness engine).
    let currency: "current" | "expired" | "missing" = "missing";
    if (latestEvidence?.collected_at) {
      const freqHours = primaryCheck?.frequency_hours ?? 24;
      // Server component renders once per request; Date.now() is stable here.
      // eslint-disable-next-line react-hooks/purity
      const ageHours = (Date.now() - new Date(latestEvidence.collected_at).getTime()) / 3_600_000;
      currency = ageHours > freqHours * 3 ? "expired" : "current";
    }
    const evidence_guidance = {
      required,
      can_auto_verify: anyAuto,
      upload_allowed: anyUpload,
      attestation_ok: anyAttest,
      currency,
    };
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
      automation_level: c.automation_level,
      evidence_summary: c.evidence_summary,
      remediation_guide: c.remediation_guide,
      report_output_text: c.report_output_text,
      default_weight: c.default_weight ?? 1.0,
      responsible_role: c.responsible_role,
      frameworks: frameworkCodes,
      mapping_count: mappings.length,
      mapping_details: mappingDetails,
      status: pc?.status ?? "not_started",
      last_verified_at: pc?.last_verified_at ?? null,
      implementation_notes: pc?.implementation_notes ?? null,
      primary_evidence_check_id: primaryCheck?.id ?? null,
      latest_evidence_at: latestEvidence?.collected_at ?? null,
      latest_evidence_status: latestEvidence?.status ?? null,
      latest_evidence_file: latestEvidence?.evidence_file_url ?? null,
      evidence_guidance,
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
      initialRole={params.role ?? null}
    />
  );
}
