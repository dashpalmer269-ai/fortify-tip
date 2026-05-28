/**
 * Attestation generator.
 *
 * Freezes the practice's compliance posture into a structured snapshot and
 * writes an attestation row (status='draft'). The snapshot is the evidentiary
 * core: per-framework readiness, full control inventory with status,
 * identified risks (non-compliant controls), safeguards in place, vendor/BAA
 * standing, and workforce exclusion-screening currency.
 *
 * document_hash = sha256(canonical(snapshot) + executive_summary) anchors
 * immutability. Once signed, the snapshot must never change.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateReportSummary } from "@/lib/ai/compliance-ai";

type Db = SupabaseClient<Database>;

export type AttestationType = "hipaa_sra" | "soc2_readiness";

export interface AttestationSnapshot {
  practice_name: string;
  generated_at: string;
  period: { start: string; end: string };
  readiness: Array<{ framework_code: string; weighted_pct: number; satisfied: number; total: number }>;
  overall_pct: number;
  controls: Array<{
    control_key: string;
    title: string;
    category: string;
    priority: string | null;
    status: string;
  }>;
  risks: Array<{ control_key: string; title: string; priority: string | null }>;
  safeguards_in_place: number;
  vendors: { total: number; with_active_baa: number; missing_baa: number };
  workforce_screening: { total_members: number; cleared: number; blocked: number; stale: number };
  evidence_summary: { total_current: number; pass: number; fail: number; partial: number };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export async function buildSnapshot(
  db: Db,
  practiceId: string,
  practiceName: string
): Promise<AttestationSnapshot> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 365 * 86400_000);

  const { data: readinessRows } = await db.rpc("audit_readiness_summary", { p_practice_id: practiceId });
  const readiness = ((readinessRows ?? []) as AttestationSnapshot["readiness"]).map((r) => ({
    framework_code: r.framework_code,
    weighted_pct: Math.round(Number(r.weighted_pct) || 0),
    satisfied: r.satisfied,
    total: r.total,
  }));
  const overall =
    readiness.length > 0 ? Math.round(readiness.reduce((s, r) => s + r.weighted_pct, 0) / readiness.length) : 0;

  // Control inventory
  const { data: pcs } = await db
    .from("practice_controls")
    .select("status, controls(control_key, title, category, default_priority)")
    .eq("practice_id", practiceId)
    .returns<
      Array<{
        status: string;
        controls: { control_key: string; title: string; category: string; default_priority: string | null } | null;
      }>
    >();
  const controls = (pcs ?? [])
    .filter((p) => p.controls)
    .map((p) => ({
      control_key: p.controls!.control_key,
      title: p.controls!.title,
      category: p.controls!.category,
      priority: p.controls!.default_priority,
      status: p.status,
    }));
  const risks = controls
    .filter((c) => c.status === "non_compliant" || c.status === "partial")
    .map((c) => ({ control_key: c.control_key, title: c.title, priority: c.priority }));
  const safeguards = controls.filter((c) => c.status === "compliant").length;

  // Vendors + BAAs
  const { data: vendors } = await db
    .from("vendors")
    .select("id, phi_access")
    .eq("practice_id", practiceId)
    .eq("phi_access", true);
  const vendorIds = (vendors ?? []).map((v) => v.id);
  let withBaa = 0;
  if (vendorIds.length > 0) {
    const { data: baas } = await db
      .from("baas")
      .select("vendor_id, status, expiration_date")
      .eq("practice_id", practiceId)
      .in("vendor_id", vendorIds);
    const valid = new Set(
      (baas ?? [])
        .filter((b) => b.status === "active" && (!b.expiration_date || new Date(b.expiration_date) > now))
        .map((b) => b.vendor_id)
    );
    withBaa = valid.size;
  }

  // Workforce screening currency
  const { data: screenings } = await db
    .from("exclusion_screenings")
    .select("status, expires_at, subject_user_id")
    .eq("practice_id", practiceId)
    .eq("subject_type", "workforce_member");
  const latestByUser = new Map<string, { status: string; expires_at: string | null }>();
  for (const s of screenings ?? []) {
    if (s.subject_user_id && !latestByUser.has(s.subject_user_id)) {
      latestByUser.set(s.subject_user_id, { status: s.status, expires_at: s.expires_at });
    }
  }
  let cleared = 0, blocked = 0, stale = 0;
  for (const v of latestByUser.values()) {
    if (v.status === "blocked") blocked++;
    else if (v.status === "cleared" || v.status === "overridden_clear") {
      if (v.expires_at && new Date(v.expires_at).getTime() < now.getTime()) stale++;
      else cleared++;
    }
  }

  // Evidence summary
  const { data: evidence } = await db
    .from("practice_evidence")
    .select("status")
    .eq("practice_id", practiceId)
    .eq("is_current", true);
  const ev = { total_current: 0, pass: 0, fail: 0, partial: 0 };
  for (const e of evidence ?? []) {
    ev.total_current++;
    if (e.status === "pass") ev.pass++;
    else if (e.status === "fail") ev.fail++;
    else if (e.status === "partial") ev.partial++;
  }

  return {
    practice_name: practiceName,
    generated_at: now.toISOString(),
    period: { start: periodStart.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
    readiness,
    overall_pct: overall,
    controls,
    risks,
    safeguards_in_place: safeguards,
    vendors: { total: vendorIds.length, with_active_baa: withBaa, missing_baa: vendorIds.length - withBaa },
    workforce_screening: { total_members: latestByUser.size, cleared, blocked, stale },
    evidence_summary: ev,
  };
}

export async function generateAttestation(
  db: Db,
  practiceId: string,
  practiceName: string,
  type: AttestationType,
  generatedByUserId: string
): Promise<{ id: string }> {
  const snapshot = await buildSnapshot(db, practiceId, practiceName);

  const title =
    type === "hipaa_sra"
      ? `HIPAA Security Risk Assessment — ${practiceName}`
      : `SOC 2 Readiness Report — ${practiceName}`;

  // AI executive summary (best-effort)
  let summary = "";
  try {
    summary = await generateReportSummary({
      practice_name: practiceName,
      report_type: type === "hipaa_sra" ? "HIPAA Security Risk Assessment" : "SOC 2 readiness assessment",
      framework: type === "hipaa_sra" ? "HIPAA" : "SOC2",
      readiness_summary: snapshot.readiness,
      critical_open: snapshot.risks.filter((r) => r.priority === "critical").length,
      recent_drift_alerts: 0,
      baas_missing: snapshot.vendors.missing_baa,
    });
  } catch {
    summary = `This ${type === "hipaa_sra" ? "Security Risk Assessment" : "SOC 2 readiness report"} reflects ${practiceName}'s posture at ${snapshot.overall_pct}% overall readiness, with ${snapshot.risks.length} open risk item(s) and ${snapshot.safeguards_in_place} safeguards verified in place.`;
  }

  const hash = createHash("sha256")
    .update(canonical(snapshot) + summary)
    .digest("hex");

  const { data: row, error } = await db
    .from("attestations")
    .insert({
      practice_id: practiceId,
      type,
      status: "draft",
      title,
      snapshot: snapshot as never,
      executive_summary: summary,
      document_hash: hash,
      period_start: snapshot.period.start,
      period_end: snapshot.period.end,
      generated_by: generatedByUserId,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to create attestation");

  await db.from("audit_logs").insert({
    practice_id: practiceId,
    actor_user_id: generatedByUserId,
    action: "attestation.generated",
    resource_type: "attestation",
    resource_id: row.id,
    metadata: { type, overall_pct: snapshot.overall_pct, risks: snapshot.risks.length },
  });

  return { id: row.id };
}
