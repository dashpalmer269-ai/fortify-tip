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

/**
 * Per-invocation cache for decrypted integration credentials. The cron passes
 * a fresh Map each run; without this, every check on the same integration
 * (e.g. 5 M365 checks) re-queries `integrations` and re-decrypts.
 */
export type CredentialCache = Map<string, { creds: unknown; note: string | null }>;

export interface RunCheckOptions {
  credentialCache?: CredentialCache;
}

export async function runCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions = {}
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
        return await runAutomatedApi(supabase, practiceId, check, options);
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
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  switch (check.source_integration) {
    case "microsoft_365":
      return await runMicrosoft365Check(supabase, practiceId, check, options);
    case "google_workspace":
      return await runGoogleWorkspaceCheck(supabase, practiceId, check, options);
    case "okta":
      return await runOktaCheck(supabase, practiceId, check, options);
    default:
      return {
        status: "not_collected",
        observed_value: null,
        raw: { note: `${check.source_integration ?? "automated_api"} runner not implemented yet` },
      };
  }
}

/**
 * Load + decrypt credentials for a connected integration of a given type.
 * Prefers encrypted_credentials_bytes (migration 015), falls back to the
 * legacy plaintext jsonb column during rollout. Returns null when not
 * connected or undecryptable.
 *
 * When `cache` is provided, results are memoized by (practiceId, integrationType)
 * for the lifetime of the cache — the cron's per-run cache avoids re-querying
 * + re-decrypting on every check against the same integration.
 */
async function loadIntegrationCreds<T>(
  supabase: SupabaseClient,
  practiceId: string,
  integrationType: string,
  cache?: CredentialCache
): Promise<{ creds: T | null; note: string | null }> {
  const cacheKey = `${practiceId}::${integrationType}`;
  if (cache?.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return { creds: cached.creds as T | null, note: cached.note };
  }

  const { data: integ } = await supabase
    .from("integrations")
    .select("id, status, encrypted_credentials, encrypted_credentials_bytes")
    .eq("practice_id", practiceId)
    .eq("integration_type", integrationType)
    .eq("status", "connected")
    .maybeSingle();

  let result: { creds: T | null; note: string | null };
  if (!integ) {
    result = { creds: null, note: `${integrationType} not connected for this practice` };
  } else if (integ.encrypted_credentials_bytes) {
    const { readCredentials } = await import("@/lib/security/credentials");
    const creds = await readCredentials<NonNullable<T>>(
      supabase as unknown as Parameters<typeof readCredentials>[0],
      integ.id
    );
    result = creds
      ? { creds: creds as T, note: null }
      : { creds: null, note: `${integrationType} credentials could not be decrypted (set CREDENTIAL_KMS_KEY?)` };
  } else if (integ.encrypted_credentials) {
    result = { creds: integ.encrypted_credentials as unknown as T, note: null };
  } else {
    result = { creds: null, note: `${integrationType} has no stored credentials` };
  }

  cache?.set(cacheKey, { creds: result.creds, note: result.note });
  return result;
}

async function runGoogleWorkspaceCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  type GwCreds = Parameters<typeof import("@/lib/integrations/google-workspace").checkAdmin2SvEnforced>[0];
  const { creds, note } = await loadIntegrationCreds<NonNullable<GwCreds>>(
    supabase,
    practiceId,
    "google_workspace",
    options.credentialCache
  );
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: note ?? "no connection" } };

  const gw = await import("@/lib/integrations/google-workspace");
  switch (check.check_key) {
    case "google_admin_2sv_enforced":
      return await gw.checkAdmin2SvEnforced(creds);
    case "google_all_2sv_enrolled":
      return await gw.checkAll2SvEnrolled(creds);
    case "google_audit_log_accessible":
      return await gw.checkAuditLogAccessible(creds);
    default:
      return { status: "not_collected", observed_value: null, raw: { note: `No Google runner for ${check.check_key}` } };
  }
}

async function runOktaCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  type OktaCreds = Parameters<typeof import("@/lib/integrations/okta").checkMfaPolicyActive>[0];
  const { creds, note } = await loadIntegrationCreds<NonNullable<OktaCreds>>(
    supabase,
    practiceId,
    "okta",
    options.credentialCache
  );
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: note ?? "no connection" } };

  const okta = await import("@/lib/integrations/okta");
  switch (check.check_key) {
    case "okta_mfa_policy_active":
      return await okta.checkMfaPolicyActive(creds);
    case "okta_admins_mfa":
      return await okta.checkAdminsMfa(creds);
    case "okta_system_log_accessible":
      return await okta.checkSystemLogAccessible(creds);
    default:
      return { status: "not_collected", observed_value: null, raw: { note: `No Okta runner for ${check.check_key}` } };
  }
}

async function runMicrosoft365Check(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  type M365Creds = Parameters<
    typeof import("@/lib/integrations/microsoft-graph").checkMfaUsersEnforced
  >[0];
  const { creds, note } = await loadIntegrationCreds<NonNullable<M365Creds>>(
    supabase,
    practiceId,
    "microsoft_365",
    options.credentialCache
  );
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: note ?? "no connection" } };

  const graph = await import("@/lib/integrations/microsoft-graph");

  switch (check.check_key) {
    case "m365_mfa_users_enforced":
      return await graph.checkMfaUsersEnforced(creds);
    case "m365_mfa_admins_enforced":
      return await graph.checkMfaAdminsEnforced(creds);
    case "m365_conditional_access_mfa":
      return await graph.checkConditionalAccessMfa(creds);
    case "m365_audit_log_enabled":
      return await graph.checkAuditLogEnabled(creds);
    case "m365_bitlocker_enforcement":
      return await graph.checkBitLockerEnforced(creds);
    default:
      return {
        status: "not_collected",
        observed_value: null,
        raw: { note: `No M365 runner mapped for ${check.check_key}` },
      };
  }
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
