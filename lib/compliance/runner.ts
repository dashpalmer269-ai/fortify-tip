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
    case "exclusion_hire_screening":
      return await checkExclusionHireScreening(supabase, practiceId, check);
    case "exclusion_monthly_rescreen":
      return await checkExclusionMonthlyRescreen(supabase, practiceId, check);
    case "policy_ack_new_hire_complete":
      return await checkPolicyAckNewHire(supabase, practiceId, check);
    case "policy_ack_current_version":
      return await checkPolicyAckCurrentVersion(supabase, practiceId, check);
    case "training_new_hire_complete":
      return await checkTrainingNewHire(supabase, practiceId, check);
    case "integration_credential_strength":
      return await checkIntegrationCredentialStrength(supabase, practiceId, check);
    default:
      return {
        status: "not_collected",
        observed_value: null,
        raw: { note: `No internal query implementation for check_key=${check.check_key}` },
      };
  }
}

/**
 * Score every connected integration and fail if any score is below the
 * configured threshold (default 60 = medium). The per-integration breakdown
 * lands in `raw` so the UI can render a credential health card.
 */
async function checkIntegrationCredentialStrength(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const minScore = (check.pass_criteria?.min_score as number) ?? 60;
  const { scoreIntegrationCredentials } = await import("@/lib/security/credential-scoring");

  const { data: integrations } = await supabase
    .from("integrations")
    .select("integration_type, status, encrypted_credentials_bytes, last_synced_at, scopes")
    .eq("practice_id", practiceId)
    .neq("status", "disconnected");
  const list = integrations ?? [];
  if (list.length === 0) {
    return {
      status: "not_collected",
      observed_value: { total_integrations: 0 },
      raw: { note: "no integrations connected" },
    };
  }

  const scored = list.map((i) => {
    const s = scoreIntegrationCredentials({
      integration_type: i.integration_type,
      status: i.status,
      encrypted_credentials_bytes: i.encrypted_credentials_bytes,
      last_synced_at: i.last_synced_at,
      scopes: i.scopes,
    });
    return {
      integration_type: i.integration_type,
      status: i.status,
      score: s.score,
      level: s.level,
      factors: s.factors,
    };
  });

  const minScored = scored.reduce((m, s) => Math.min(m, s.score), 100);
  const avgScore = Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length);
  const failing = scored.filter((s) => s.score < minScore);

  return {
    status: failing.length === 0 ? "pass" : minScored < 30 ? "fail" : "partial",
    observed_value: {
      total_integrations: scored.length,
      avg_score: avgScore,
      min_score: minScored,
      below_threshold: failing.length,
      threshold: minScore,
    },
    raw: { per_integration: scored, failing_types: failing.map((f) => f.integration_type) },
  };
}

/**
 * Exclusion screening at hire: every workforce member should have a
 * pre-hire screening record with status cleared / overridden_clear.
 */
async function checkExclusionHireScreening(
  supabase: SupabaseClient,
  practiceId: string,
  _check: EvidenceCheckRow
): Promise<CheckResult> {
  const { data: members, error: mErr } = await supabase
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId);
  if (mErr) return errorResult(mErr.message);
  const total = members?.length ?? 0;
  if (total === 0) {
    return { status: "not_collected", observed_value: { total_members: 0 }, raw: { note: "no workforce members" } };
  }

  const { data: screenings, error: sErr } = await supabase
    .from("exclusion_screenings")
    .select("subject_user_id, status")
    .eq("practice_id", practiceId)
    .eq("subject_type", "workforce_member")
    .in("status", ["cleared", "overridden_clear"]);
  if (sErr && sErr.code !== "42P01") return errorResult(sErr.message);

  const screenedIds = new Set((screenings ?? []).map((s) => s.subject_user_id).filter(Boolean));
  const unscreened = (members ?? []).filter((m) => !screenedIds.has(m.user_id));

  return {
    status: unscreened.length === 0 ? "pass" : "fail",
    observed_value: {
      total_members: total,
      screened: total - unscreened.length,
      unscreened: unscreened.length,
    },
    raw: { unscreened_user_ids: unscreened.map((m) => m.user_id) },
  };
}

/**
 * Monthly LEIE re-screen: every active member should have a screening
 * record dated within max_age_days (default 30).
 */
async function checkExclusionMonthlyRescreen(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const maxAge = (check.check_config?.max_age_days as number) ?? 30;
  const cutoff = new Date(Date.now() - maxAge * 86400_000).toISOString();

  const { data: members, error: mErr } = await supabase
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId);
  if (mErr) return errorResult(mErr.message);
  const total = members?.length ?? 0;
  if (total === 0) {
    return { status: "not_collected", observed_value: { total_members: 0 }, raw: { note: "no workforce members" } };
  }

  const { data: screenings, error: sErr } = await supabase
    .from("exclusion_screenings")
    .select("subject_user_id, screened_at")
    .eq("practice_id", practiceId)
    .eq("subject_type", "workforce_member")
    .gte("screened_at", cutoff);
  if (sErr && sErr.code !== "42P01") return errorResult(sErr.message);

  const recentIds = new Set((screenings ?? []).map((s) => s.subject_user_id).filter(Boolean));
  const stale = (members ?? []).filter((m) => !recentIds.has(m.user_id));

  return {
    status: stale.length === 0 ? "pass" : "fail",
    observed_value: {
      total_members: total,
      recently_screened: total - stale.length,
      stale: stale.length,
      max_age_days: maxAge,
    },
    raw: { stale_user_ids: stale.map((m) => m.user_id) },
  };
}

/**
 * New-hire policy acks: any member hired more than `max_age_days` ago
 * (default 7) must have an acknowledgement for every active policy.
 */
async function checkPolicyAckNewHire(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const maxAge = (check.check_config?.max_age_days as number) ?? 7;
  const cutoff = new Date(Date.now() - maxAge * 86400_000).toISOString();

  const { data: members, error: mErr } = await supabase
    .from("practice_users")
    .select("user_id, created_at")
    .eq("practice_id", practiceId)
    .lt("created_at", cutoff); // hired >max_age days ago
  if (mErr) return errorResult(mErr.message);

  const { data: policies, error: pErr } = await supabase
    .from("policies")
    .select("id")
    .eq("practice_id", practiceId)
    .eq("status", "active");
  if (pErr && pErr.code !== "42P01") return errorResult(pErr.message);
  const policyIds = (policies ?? []).map((p) => p.id);
  if (policyIds.length === 0 || !members || members.length === 0) {
    return { status: "pass", observed_value: { eligible_members: members?.length ?? 0, active_policies: policyIds.length, missing: 0 }, raw: null };
  }

  const { data: acks, error: aErr } = await supabase
    .from("policy_acknowledgments")
    .select("user_id, policy_id")
    .eq("practice_id", practiceId)
    .in("policy_id", policyIds);
  if (aErr && aErr.code !== "42P01") return errorResult(aErr.message);

  const ackedPairs = new Set((acks ?? []).map((a) => `${a.user_id}:${a.policy_id}`));
  let missing = 0;
  for (const m of members) {
    for (const p of policyIds) {
      if (!ackedPairs.has(`${m.user_id}:${p}`)) missing++;
    }
  }

  return {
    status: missing === 0 ? "pass" : "fail",
    observed_value: {
      eligible_members: members.length,
      active_policies: policyIds.length,
      missing_acknowledgements: missing,
      max_age_days: maxAge,
    },
    raw: null,
  };
}

/**
 * Current-version policy ack coverage across all members. Passes when
 * coverage ≥ min_coverage_pct (default 95).
 */
async function checkPolicyAckCurrentVersion(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const minPct = (check.check_config?.min_coverage_pct as number) ?? 95;

  const { data: members } = await supabase
    .from("practice_users")
    .select("user_id")
    .eq("practice_id", practiceId);
  const memberIds = (members ?? []).map((m) => m.user_id);

  const { data: policies, error: pErr } = await supabase
    .from("policies")
    .select("id, version")
    .eq("practice_id", practiceId)
    .eq("status", "active");
  if (pErr && pErr.code !== "42P01") return errorResult(pErr.message);
  const activePolicies = policies ?? [];
  if (activePolicies.length === 0 || memberIds.length === 0) {
    return { status: "pass", observed_value: { coverage_pct: 100, members: memberIds.length, policies: activePolicies.length }, raw: null };
  }

  const { data: acks, error: aErr } = await supabase
    .from("policy_acknowledgments")
    .select("user_id, policy_id, policy_version")
    .eq("practice_id", practiceId)
    .in("policy_id", activePolicies.map((p) => p.id));
  if (aErr && aErr.code !== "42P01") return errorResult(aErr.message);

  const ackedSet = new Set(
    (acks ?? []).map((a) => `${a.user_id}:${a.policy_id}:${a.policy_version}`)
  );
  const expectedPairs = memberIds.length * activePolicies.length;
  let satisfied = 0;
  for (const m of memberIds) {
    for (const p of activePolicies) {
      if (ackedSet.has(`${m}:${p.id}:${p.version ?? 1}`)) satisfied++;
    }
  }
  const coveragePct = Math.round((satisfied / expectedPairs) * 100);

  return {
    status:
      coveragePct >= minPct ? "pass" : coveragePct > 0 ? "partial" : "fail",
    observed_value: {
      coverage_pct: coveragePct,
      satisfied,
      expected: expectedPairs,
      min_coverage_pct: minPct,
    },
    raw: null,
  };
}

/**
 * New-hire HIPAA training: any member hired more than `max_age_days` ago
 * (default 30) must have a training completion record.
 */
async function checkTrainingNewHire(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow
): Promise<CheckResult> {
  const maxAge = (check.check_config?.max_age_days as number) ?? 30;
  const cutoff = new Date(Date.now() - maxAge * 86400_000).toISOString();

  const { data: members, error: mErr } = await supabase
    .from("practice_users")
    .select("user_id, created_at")
    .eq("practice_id", practiceId)
    .lt("created_at", cutoff);
  if (mErr) return errorResult(mErr.message);
  if (!members || members.length === 0) {
    return { status: "pass", observed_value: { eligible_members: 0, untrained: 0 }, raw: null };
  }

  const { data: completions, error: cErr } = await supabase
    .from("training_completions")
    .select("user_id")
    .eq("practice_id", practiceId);
  if (cErr && cErr.code !== "42P01") return errorResult(cErr.message);

  const trainedIds = new Set((completions ?? []).map((c) => c.user_id));
  const untrained = members.filter((m) => !trainedIds.has(m.user_id));

  return {
    status: untrained.length === 0 ? "pass" : "fail",
    observed_value: {
      eligible_members: members.length,
      trained: members.length - untrained.length,
      untrained: untrained.length,
      max_age_days: maxAge,
    },
    raw: { untrained_user_ids: untrained.map((m) => m.user_id) },
  };
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
  _check: EvidenceCheckRow
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
    case "aws":
      return await runAwsCheck(supabase, practiceId, check, options);
    case "docusign":
      return await runDocuSignCheck(supabase, practiceId, check, options);
    default:
      return {
        status: "not_collected",
        observed_value: null,
        raw: { note: `${check.source_integration ?? "automated_api"} runner not implemented yet` },
      };
  }
}

async function runAwsCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  const { creds, note } = await loadIntegrationCreds<
    import("@/lib/integrations/aws").AwsCreds
  >(supabase, practiceId, "aws", options.credentialCache);
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: note ?? "no connection" } };

  const aws = await import("@/lib/integrations/aws");
  switch (check.check_key) {
    case "aws_cloudtrail_multi_region":
      return await aws.checkCloudTrailMultiRegion(creds);
    case "aws_iam_root_mfa":
      return await aws.checkRootAccountMfa(creds);
    case "aws_iam_user_mfa_enforced":
      return await aws.checkIamUserMfa(creds);
    case "aws_s3_no_public_buckets":
      return await aws.checkS3NoPublicBuckets(creds);
    case "aws_s3_default_encryption":
      return await aws.checkS3DefaultEncryption(creds);
    case "aws_guardduty_enabled":
      return await aws.checkGuardDutyEnabled(creds);
    case "aws_security_groups_open":
      return await aws.checkSecurityGroupsOpen(creds);
    case "aws_unused_access_keys":
      return await aws.checkUnusedAccessKeys(creds, (check.check_config?.max_age_days as number) ?? 90);
    default:
      return { status: "not_collected", observed_value: null, raw: { note: `No AWS runner for ${check.check_key}` } };
  }
}

async function runDocuSignCheck(
  supabase: SupabaseClient,
  practiceId: string,
  check: EvidenceCheckRow,
  options: RunCheckOptions
): Promise<CheckResult> {
  type DsCreds = Parameters<typeof import("@/lib/integrations/docusign").checkAccountAccessible>[0];
  const { creds, note } = await loadIntegrationCreds<NonNullable<DsCreds>>(
    supabase,
    practiceId,
    "docusign",
    options.credentialCache
  );
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: note ?? "no connection" } };

  const ds = await import("@/lib/integrations/docusign");
  switch (check.check_key) {
    case "docusign_account_accessible":
      return await ds.checkAccountAccessible(creds);
    case "docusign_signed_compliance_envelopes":
      return await ds.checkSignedComplianceEnvelopes(creds, (check.check_config?.window_days as number) ?? 365);
    case "docusign_outstanding_envelopes":
      return await ds.checkOutstandingEnvelopes(creds, (check.check_config?.max_age_days as number) ?? 30);
    default:
      return { status: "not_collected", observed_value: null, raw: { note: `No DocuSign runner for ${check.check_key}` } };
  }
}

/**
 * Load + decrypt credentials for a connected integration. Sole read path —
 * `encrypted_credentials_bytes` is the only storage; the legacy plaintext
 * jsonb column was dropped in migration 028. If decryption fails or the
 * row is missing the encrypted blob, we return null with a note (callers
 * surface this as 'not_collected' so the audit trail records the gap).
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
    .select("id, status, encrypted_credentials_bytes")
    .eq("practice_id", practiceId)
    .eq("integration_type", integrationType)
    .eq("status", "connected")
    .maybeSingle();

  let result: { creds: T | null; note: string | null };
  if (!integ) {
    result = { creds: null, note: `${integrationType} not connected for this practice` };
  } else if (!integ.encrypted_credentials_bytes) {
    // CHECK constraint should prevent this, but defense in depth.
    result = {
      creds: null,
      note: `${integrationType} integration is in an invalid state (no encrypted credentials). Please reconnect.`,
    };
  } else {
    const { readCredentials } = await import("@/lib/security/credentials");
    const creds = await readCredentials<NonNullable<T>>(
      supabase as unknown as Parameters<typeof readCredentials>[0],
      integ.id
    );
    result = creds
      ? { creds: creds as T, note: null }
      : { creds: null, note: `${integrationType} credentials could not be decrypted (verify CREDENTIAL_KMS_KEY)` };
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
    case "google_audit_log_accessible_v2":
      return await gw.checkAuditLogAccessible(creds);
    case "google_admin_inventory":
      return await gw.checkAdminInventory(creds);
    case "google_inactive_users":
      return await gw.checkInactiveUsers(creds, (check.check_config?.max_days_since_login as number) ?? 90);
    case "google_external_sharing":
      return await gw.checkExternalSharing(creds);
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
    case "okta_system_log_accessible_v2":
      return await okta.checkSystemLogAccessible(creds);
    case "okta_admin_role_inventory":
      return await okta.checkAdminRoleInventory(creds);
    case "okta_inactive_users":
      return await okta.checkInactiveUsers(creds, (check.check_config?.max_days_since_login as number) ?? 90);
    case "okta_password_policy":
      return await okta.checkPasswordPolicy(creds);
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
    case "m365_bitlocker_enforcement_v2":
      return await graph.checkBitLockerEnforced(creds);
    case "m365_inactive_users":
      return await graph.checkInactiveUsers(creds, (check.check_config?.max_days_since_signin as number) ?? 90);
    case "m365_risky_guest_users":
      return await graph.checkRiskyGuestUsers(creds);
    case "m365_mailbox_forwarding":
      return await graph.checkMailboxForwarding(creds);
    case "m365_security_defaults":
      return await graph.checkSecurityDefaults(creds);
    case "m365_audit_log_enabled_v2":
      return await graph.checkAuditLogEnabled(creds);
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
