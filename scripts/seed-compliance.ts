/**
 * Idempotent loader for the compliance control library.
 * Reads supabase/seed/compliance-seed.json and upserts every framework,
 * requirement, control, mapping, evidence check, and remediation guidance row.
 * Safe to re-run: every record keyed by a natural unique key.
 *
 * Run with: npx tsx scripts/seed-compliance.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import ws from "ws";

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

interface Seed {
  frameworks: Array<{
    code: string;
    name: string;
    authority?: string;
    current_version?: string;
    description?: string;
  }>;
  framework_requirements: Array<{
    framework_code: string;
    citation: string;
    parent_citation?: string;
    title: string;
    description: string;
    category?: string;
    obligation_type: "required" | "addressable" | "recommended";
    weight?: number;
    source_url?: string;
  }>;
  controls: Array<{
    control_key: string;
    title: string;
    description: string;
    category: string;
    implementation_type: "technical" | "administrative" | "physical";
    default_priority?: "critical" | "high" | "medium" | "low";
    healthcare_baseline?: boolean;
  }>;
  framework_mappings: Array<{
    control_key: string;
    framework_code: string;
    citation: string;
    mapping_strength?: "fully_satisfies" | "partially_satisfies" | "contributes_to";
    notes?: string;
  }>;
  evidence_checks: Array<{
    control_key: string;
    check_key: string;
    title: string;
    description?: string;
    collection_method: string;
    source_integration?: string;
    frequency_hours?: number;
    check_config?: Record<string, unknown>;
    pass_criteria?: Record<string, unknown>;
    evidence_retention_days?: number;
  }>;
  remediation_guidance: Array<{
    control_key: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    step_by_step_markdown: string;
    estimated_effort_minutes?: number;
    required_systems?: string[];
    source_url?: string;
  }>;
}

async function main() {
  const seedPath = path.resolve(__dirname, "../supabase/seed/compliance-seed.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as Seed;

  console.log(`Seeding from ${seedPath}`);
  console.log(
    `  ${seed.frameworks.length} frameworks · ${seed.framework_requirements.length} requirements · ${seed.controls.length} controls · ${seed.framework_mappings.length} mappings · ${seed.evidence_checks.length} evidence checks · ${seed.remediation_guidance.length} remediation guidances`
  );

  // ── 1. Frameworks ─────────────────────────────────────────────────────────
  console.log("\n[1/6] Upserting frameworks…");
  const { error: fErr } = await supabase
    .from("frameworks")
    .upsert(seed.frameworks, { onConflict: "code" });
  if (fErr) throw new Error(`frameworks upsert failed: ${fErr.message}`);

  const { data: frameworkRows } = await supabase.from("frameworks").select("id, code");
  const frameworkIdByCode = new Map((frameworkRows ?? []).map((r) => [r.code, r.id]));

  // ── 2. Framework requirements ─────────────────────────────────────────────
  console.log("[2/6] Upserting framework requirements…");
  const reqRows = seed.framework_requirements.map((r) => {
    const framework_id = frameworkIdByCode.get(r.framework_code);
    if (!framework_id) throw new Error(`Unknown framework_code ${r.framework_code}`);
    const { framework_code: _unused, ...rest } = r;
    return { ...rest, framework_id };
  });
  const { error: rErr } = await supabase
    .from("framework_requirements")
    .upsert(reqRows, { onConflict: "framework_id,citation" });
  if (rErr) throw new Error(`framework_requirements upsert failed: ${rErr.message}`);

  const { data: requirementRows } = await supabase
    .from("framework_requirements")
    .select("id, framework_id, citation");
  // Build lookup: (framework_code, citation) -> id
  const reqIdByKey = new Map<string, string>();
  for (const r of requirementRows ?? []) {
    const fwCode = [...frameworkIdByCode.entries()].find(([_, id]) => id === r.framework_id)?.[0];
    if (fwCode) reqIdByKey.set(`${fwCode}::${r.citation}`, r.id);
  }

  // ── 3. Controls ───────────────────────────────────────────────────────────
  console.log("[3/6] Upserting controls…");
  const { error: cErr } = await supabase
    .from("controls")
    .upsert(seed.controls, { onConflict: "control_key" });
  if (cErr) throw new Error(`controls upsert failed: ${cErr.message}`);

  const { data: controlRows } = await supabase.from("controls").select("id, control_key");
  const controlIdByKey = new Map((controlRows ?? []).map((r) => [r.control_key, r.id]));

  // ── 4. Framework mappings ─────────────────────────────────────────────────
  console.log("[4/6] Upserting framework mappings…");
  const mappingRows = seed.framework_mappings.map((m) => {
    const control_id = controlIdByKey.get(m.control_key);
    if (!control_id) throw new Error(`Unknown control_key ${m.control_key}`);
    const framework_requirement_id = reqIdByKey.get(`${m.framework_code}::${m.citation}`);
    if (!framework_requirement_id) {
      throw new Error(`Unknown requirement ${m.framework_code} ${m.citation} for control ${m.control_key}`);
    }
    return {
      control_id,
      framework_requirement_id,
      mapping_strength: m.mapping_strength ?? "fully_satisfies",
      notes: m.notes ?? null,
    };
  });
  const { error: mErr } = await supabase
    .from("framework_mappings")
    .upsert(mappingRows, { onConflict: "control_id,framework_requirement_id" });
  if (mErr) throw new Error(`framework_mappings upsert failed: ${mErr.message}`);

  // ── 5. Evidence checks ────────────────────────────────────────────────────
  console.log("[5/6] Upserting evidence checks…");
  const checkRows = seed.evidence_checks.map((ec) => {
    const control_id = controlIdByKey.get(ec.control_key);
    if (!control_id) throw new Error(`Unknown control_key ${ec.control_key}`);
    const { control_key: _unused, ...rest } = ec;
    return { ...rest, control_id };
  });
  const { error: ecErr } = await supabase
    .from("evidence_checks")
    .upsert(checkRows, { onConflict: "control_id,check_key" });
  if (ecErr) throw new Error(`evidence_checks upsert failed: ${ecErr.message}`);

  // ── 6. Remediation guidance ───────────────────────────────────────────────
  // No natural unique key — wipe per-control then re-insert for idempotence.
  console.log("[6/6] Replacing remediation guidance…");
  const controlIds = Array.from(new Set(seed.remediation_guidance.map((g) => g.control_key)))
    .map((k) => controlIdByKey.get(k)!)
    .filter(Boolean);
  if (controlIds.length > 0) {
    const { error: delErr } = await supabase
      .from("remediation_guidance")
      .delete()
      .in("control_id", controlIds);
    if (delErr) throw new Error(`remediation_guidance delete failed: ${delErr.message}`);
  }
  const guidanceRows = seed.remediation_guidance.map((g) => {
    const control_id = controlIdByKey.get(g.control_key);
    if (!control_id) throw new Error(`Unknown control_key ${g.control_key}`);
    const { control_key: _unused, ...rest } = g;
    return { ...rest, control_id, ai_generated: false };
  });
  const { error: gErr } = await supabase.from("remediation_guidance").insert(guidanceRows);
  if (gErr) throw new Error(`remediation_guidance insert failed: ${gErr.message}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    supabase.from("frameworks").select("*", { count: "exact", head: true }),
    supabase.from("framework_requirements").select("*", { count: "exact", head: true }),
    supabase.from("controls").select("*", { count: "exact", head: true }),
    supabase.from("framework_mappings").select("*", { count: "exact", head: true }),
    supabase.from("evidence_checks").select("*", { count: "exact", head: true }),
    supabase.from("remediation_guidance").select("*", { count: "exact", head: true }),
  ]);

  console.log("\nSeed complete. Library counts:");
  console.log(`  frameworks:             ${counts[0].count}`);
  console.log(`  framework_requirements: ${counts[1].count}`);
  console.log(`  controls:               ${counts[2].count}`);
  console.log(`  framework_mappings:     ${counts[3].count}`);
  console.log(`  evidence_checks:        ${counts[4].count}`);
  console.log(`  remediation_guidance:   ${counts[5].count}`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
