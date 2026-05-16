/**
 * Compliance check runner.
 *
 * For each evidence_check defined in the library, runCheck() dispatches to the
 * appropriate runner based on collection_method, executes it for one practice,
 * and returns a normalized { status, observed_value, raw } result.
 *
 * Integration runners (M365 Graph, AWS, Datto, etc.) are scaffolded as
 * placeholders here — they short-circuit to "not_collected" until real
 * integrations are wired up. Internal DB-query and manual-attestation runners
 * are real and functional today.
 */
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CheckStatus = "pass" | "fail" | "partial" | "not_collected" | "error";

export interface CheckResult {
  status: CheckStatus;
  observed_value: unknown;
  raw: unknown;
}

export interface EvidenceCheckRow {
  id: string;
  control_id: string;
  check_key: string;
  collection_method: string;
  source_integration: string | null;
  check_config: Record<string, unknown> | null;
  pass_criteria: Record<string, unknown> | null;
}

/**
 * Canonicalize a value before hashing so logically-equal JSON produces the same
 * hash regardless of property order or whitespace.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export function stateHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function runCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  try {
    switch (check.collection_method) {
      case "automated_db_query":
        return await runInternalQuery(supabase, practiceId, check);
      case "manual_attestation":
        return await runManualAttestation(supabase, practiceId, check);
      case "document_upload":
        return await runDocumentRecency(supabase, practiceId, check);
      case "automated_api":
        return await runAutomatedApi(supabase, practiceId, check);
      case "automated_scan":
        return await runAutomatedScan(supabase, practiceId, check);
      case "screenshot":
        return await runDocumentRecency(supabase, practiceId, check); // same recency check
      default:
        return { status: "error", observed_value: null, raw: { error: `Unknown method ${check.collection_method}` } };
    }
  } catch (err) {
    return {
      status: "error",
      observed_value: null,
      raw: { error: (err as Error).message },
    };
  }
}

// ─── Internal DB-query runners ───────────────────────────────────────────────

async function runInternalQuery(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  // Each check_key maps to a known internal query. Adding new internal checks
  // is a matter of adding one case to this switch — keeps the runner inspectable.
  switch (check.check_key) {
    case "training_completion_rate":
      return await checkTrainingCompletion(supabase, practiceId, check);
    case "risk_analysis_current":
      return await checkRiskAnalysisRecency(supabase, practiceId, check);
    case "all_phi_vendors_have_baa":
      return await checkVendorsHaveBaa(supabase, practiceId, check);
    default:
      return {
        status: "not_collected",
        observed_value: null,
        raw: { note: `No internal query implementation for check_key=${check.check_key}` },
      };
  }
}

async function checkTrainingCompletion(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const windowDays = (check.check_config?.window_days as number) ?? 365;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Tables `practice_users` and `training_completions` come from the broader spec.
  // Training_completions doesn't exist yet — return not_collected gracefully.
  const { data: users, error: uErr } = await supabase
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId);
  if (uErr) return errorResult(uErr.message);
  const totalUsers = users?.length ?? 0;
  if (totalUsers === 0) {
    return { status: "not_collected", observed_value: { total_users: 0 }, raw: null };
  }

  // training_completions table is part of the Phase 2 training module.
  const { data: completions, error: cErr } = await supabase
    .from("training_completions")
    .select("user_id")
    .eq("practice_id", practiceId)
    .gte("completed_at", cutoff);

  if (cErr && cErr.code !== "42P01") return errorResult(cErr.message); // 42P01 = undefined_table
  const completedUserIds = new Set((completions ?? []).map((c) => c.user_id));
  const completion_rate = completedUserIds.size / totalUsers;

  const minRate = ((check.pass_criteria?.value as number) ?? 0.95);
  const status: CheckStatus = completion_rate >= minRate ? "pass" : completion_rate > 0 ? "partial" : "fail";

  return {
    status,
    observed_value: { completion_rate, completed_users: completedUserIds.size, total_users: totalUsers },
    raw: { window_days: windowDays },
  };
}

async function checkRiskAnalysisRecency(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const maxAge = (check.check_config?.max_age_days as number) ?? 365;
  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("risk_assessments")
    .select("id, assessment_date")
    .eq("practice_id", practiceId)
    .gte("assessment_date", cutoff)
    .order("assessment_date", { ascending: false })
    .limit(1);

  if (error && error.code !== "42P01") return errorResult(error.message);
  const latest = data?.[0];
  return {
    status: latest ? "pass" : "fail",
    observed_value: { latest_assessment_date: latest?.assessment_date ?? null, max_age_days: maxAge },
    raw: null,
  };
}

async function checkVendorsHaveBaa(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  // Vendors and baas tables are part of the BAA Vault module.
  const { data: vendors, error: vErr } = await supabase
    .from("vendors")
    .select("id, vendor_name, phi_access")
    .eq("practice_id", practiceId)
    .eq("phi_access", true);
  if (vErr && vErr.code !== "42P01") return errorResult(vErr.message);
  if (!vendors || vendors.length === 0) {
    return { status: "pass", observed_value: { vendors_with_phi: 0, vendors_missing_baa: 0 }, raw: null };
  }

  const vendorIds = vendors.map((v) => v.id);
  const { data: baas, error: bErr } = await supabase
    .from("baas")
    .select("vendor_id, status, expiration_date")
    .eq("practice_id", practiceId)
    .in("vendor_id", vendorIds);
  if (bErr && bErr.code !== "42P01") return errorResult(bErr.message);

  const now = new Date();
  const validVendorIds = new Set(
    (baas ?? [])
      .filter((b) => b.status === "active" && (!b.expiration_date || new Date(b.expiration_date) > now))
      .map((b) => b.vendor_id)
  );
  const missing = vendors.filter((v) => !validVendorIds.has(v.id));
  return {
    status: missing.length === 0 ? "pass" : "fail",
    observed_value: { vendors_with_phi: vendors.length, vendors_missing_baa: missing.length },
    raw: { missing_vendor_names: missing.map((v) => v.vendor_name) },
  };
}

// ─── Manual attestation ──────────────────────────────────────────────────────

async function runManualAttestation(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const renewalDays = (check.pass_criteria?.value as number) ?? 90;
  const cutoff = new Date(Date.now() - renewalDays * 24 * 60 * 60 * 1000).toISOString();

  // Look at the most recent practice_evidence row of this check; if collected
  // within the renewal window AND collected_by is set (i.e. a human attested),
  // it passes. Otherwise fails / not_collected.
  const { data, error } = await supabase
    .from("practice_evidence")
    .select("status, collected_at, collected_by")
    .eq("practice_id", practiceId)
    .eq("evidence_check_id", check.id)
    .order("collected_at", { ascending: false })
    .limit(1);
  if (error) return errorResult(error.message);

  const latest = data?.[0];
  if (!latest) return { status: "not_collected", observed_value: null, raw: null };
  if (!latest.collected_by) return { status: "not_collected", observed_value: null, raw: null };
  if (latest.collected_at < cutoff) {
    return {
      status: "fail",
      observed_value: { last_attested_at: latest.collected_at, renewal_due: true },
      raw: null,
    };
  }
  return {
    status: "pass",
    observed_value: { last_attested_at: latest.collected_at, renewal_due: false },
    raw: null,
  };
}

// ─── Document upload recency ─────────────────────────────────────────────────

async function runDocumentRecency(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const maxAge = (check.check_config?.max_age_days as number) ?? 365;
  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("practice_evidence")
    .select("collected_at, evidence_file_url, notes")
    .eq("practice_id", practiceId)
    .eq("evidence_check_id", check.id)
    .not("evidence_file_url", "is", null)
    .gte("collected_at", cutoff)
    .order("collected_at", { ascending: false })
    .limit(1);
  if (error) return errorResult(error.message);
  const latest = data?.[0];
  return {
    status: latest ? "pass" : "fail",
    observed_value: {
      latest_document_at: latest?.collected_at ?? null,
      max_age_days: maxAge,
    },
    raw: null,
  };
}

// ─── Stubs: real integration runners (M365 Graph, scanners) ─────────────────

async function runAutomatedApi(
  _supabase: SupabaseClient,
  _practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  // Real integration not wired yet. Phase 1.5 will implement runners for
  // microsoft_365, aws, datto, etc. For now we report "not_collected" so the
  // verifier doesn't block the rest of the pipeline.
  return {
    status: "not_collected",
    observed_value: null,
    raw: { note: `${check.source_integration ?? "automated_api"} runner not implemented yet` },
  };
}

async function runAutomatedScan(
  _supabase: SupabaseClient,
  _practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  return {
    status: "not_collected",
    observed_value: null,
    raw: { note: `scanner runner not implemented yet (${check.check_key})` },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function errorResult(msg: string): CheckResult {
  return { status: "error", observed_value: null, raw: { error: msg } };
}

/**
 * After evidence updates, roll the practice_control.status forward based on
 * the latest is_current evidence rows for this control.
 *   any  fail  → non_compliant
 *   any  partial (and no fail) → partial
 *   all  pass → compliant
 *   none collected → not_started
 */
export async function recomputeControlStatus(
  supabase: SupabaseClient,
  practiceId: string,
  controlId: string
): Promise<void> {
  const { data: checks, error: ecErr } = await supabase
    .from("evidence_checks")
    .select("id")
    .eq("control_id", controlId);
  if (ecErr || !checks || checks.length === 0) return;
  const checkIds = checks.map((c) => c.id);

  const { data: evidence } = await supabase
    .from("practice_evidence")
    .select("status, evidence_check_id")
    .eq("practice_id", practiceId)
    .eq("is_current", true)
    .in("evidence_check_id", checkIds);

  const statuses = (evidence ?? []).map((e) => e.status as CheckStatus);
  let newStatus: "compliant" | "partial" | "non_compliant" | "not_started";
  if (statuses.length === 0) newStatus = "not_started";
  else if (statuses.some((s) => s === "fail")) newStatus = "non_compliant";
  else if (statuses.some((s) => s === "partial")) newStatus = "partial";
  else if (statuses.every((s) => s === "pass")) newStatus = "compliant";
  else newStatus = "not_started";

  await supabase
    .from("practice_controls")
    .upsert(
      {
        practice_id: practiceId,
        control_id: controlId,
        status: newStatus,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "practice_id,control_id" }
    );
}
