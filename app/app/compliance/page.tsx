import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import ComplianceBrowser from "./ComplianceBrowser";

export const dynamic = "force-dynamic";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ framework?: string; category?: string; status?: string }>;
}) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const params = await searchParams;

  // Pull every control + this practice's state + mapping counts in one shot.
  const { data: controls } = await supabase
    .from("controls")
    .select(`
      id, control_key, title, description, category, implementation_type,
      default_priority, healthcare_baseline,
      framework_mappings(framework_requirements(framework_id, frameworks(code)))
    `)
    .order("default_priority", { ascending: true })
    .order("category", { ascending: true });

  const { data: practiceControls } = await supabase
    .from("practice_controls")
    .select("control_id, status, last_verified_at, implementation_notes")
    .eq("practice_id", session.membership.practice_id);

  const statusByControlId = new Map(
    (practiceControls ?? []).map((pc) => [pc.control_id, pc])
  );

  const enriched = (controls ?? []).map((c) => {
    type MappingShape = {
      framework_requirements: { frameworks: { code: string } } | null;
    };
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
      initialStatus={params.status ?? null}
    />
  );
}
