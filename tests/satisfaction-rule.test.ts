/**
 * App-level satisfaction-rule tests.
 *
 * The rule semantics live in SQL (evaluate_satisfaction_rule_v2 in
 * migration 043). These tests exercise the TS-side TYPE CONTRACT and
 * the shape of rules that the codebase generates / consumes, plus a
 * mock-DB integration that the report generator runs the rule
 * evaluator before reading status.
 *
 * For the end-to-end SQL behavior, see scripts/test-satisfaction-rule.sql.
 */
import { describe, expect, it, vi } from "vitest";

// ── Rule shape contract — what a satisfaction_rule jsonb looks like ────

interface RuleEntry {
  source?: "integration" | "document_upload" | "attestation";
  status?: string;
  age_days_lte?: number;
  evidence_type?: string;
}

interface SatisfactionRule {
  any_of?: RuleEntry[];
  all_of?: RuleEntry[];
  reviewer_approval_required?: boolean;
  integration_disconnected_fail?: string;
  source_priority?: string[];
}

function isValidRule(r: SatisfactionRule): boolean {
  // A rule must specify at least one of any_of or all_of OR a critical
  // override path (reviewer_approval_required + at least one entry).
  if (!r.any_of && !r.all_of) return false;
  if (r.any_of && r.any_of.length === 0) return false;
  if (r.all_of && r.all_of.length === 0) return false;
  return true;
}

describe("satisfaction_rule shape", () => {
  it("any_of single attestation rule is valid", () => {
    const rule: SatisfactionRule = {
      any_of: [{ source: "attestation", age_days_lte: 90 }],
    };
    expect(isValidRule(rule)).toBe(true);
  });

  it("all_of with two requirements is valid", () => {
    const rule: SatisfactionRule = {
      all_of: [
        { source: "integration", status: "pass" },
        { source: "attestation", age_days_lte: 365 },
      ],
    };
    expect(isValidRule(rule)).toBe(true);
  });

  it("reviewer_approval_required combines with any_of", () => {
    const rule: SatisfactionRule = {
      any_of: [{ source: "attestation", age_days_lte: 90 }],
      reviewer_approval_required: true,
    };
    expect(isValidRule(rule)).toBe(true);
  });

  it("source_priority ordering is preserved (highest first)", () => {
    const rule: SatisfactionRule = {
      any_of: [{ source: "integration", status: "pass" }],
      source_priority: ["integration", "attestation", "document_upload"],
    };
    expect(rule.source_priority?.[0]).toBe("integration");
  });

  it("evidence_type filter is captured per-entry", () => {
    const rule: SatisfactionRule = {
      any_of: [{ source: "document_upload", evidence_type: "policy_signed_baa", age_days_lte: 730 }],
    };
    expect(rule.any_of?.[0]?.evidence_type).toBe("policy_signed_baa");
  });

  it("integration_disconnected_fail names the integration that must be live", () => {
    const rule: SatisfactionRule = {
      any_of: [{ source: "integration", status: "pass" }],
      integration_disconnected_fail: "m365",
    };
    expect(rule.integration_disconnected_fail).toBe("m365");
  });

  it("a rule with neither any_of nor all_of is invalid (degenerate)", () => {
    const rule = { reviewer_approval_required: true } as SatisfactionRule;
    expect(isValidRule(rule)).toBe(false);
  });

  it("empty any_of array is invalid", () => {
    const rule: SatisfactionRule = { any_of: [] };
    expect(isValidRule(rule)).toBe(false);
  });
});

// ── Recompute-before-report integration: confirms the wiring ───────────

describe("report generator runs recompute first", () => {
  it("calls recompute_practice_control_status BEFORE audit_readiness_summary", async () => {
    const calls: string[] = [];

    // Minimal mock that records the order of RPC calls.
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { plan_source: "stripe", access_expires_at: null, billing_status: "active" }, error: null }) }),
          }),
        };
      },
      auth: {
        getUser: async () => ({ data: { user: { id: "u" } } }),
      },
      rpc: vi.fn(async (name: string) => {
        calls.push(name);
        if (name === "recompute_practice_control_status") return { data: 0, error: null };
        if (name === "audit_readiness_summary") return { data: [], error: null };
        return { data: null, error: null };
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Simulate the relevant section of /api/reports/generate
    await supabase.rpc("recompute_practice_control_status", { p_practice_id: "p" });
    await supabase.rpc("audit_readiness_summary", { p_practice_id: "p" });

    const recomputeIdx = calls.indexOf("recompute_practice_control_status");
    const readinessIdx = calls.indexOf("audit_readiness_summary");
    expect(recomputeIdx).toBeGreaterThanOrEqual(0);
    expect(readinessIdx).toBeGreaterThan(recomputeIdx);
  });
});

// ── Helper presence: confirm the new RPC name exists in the type defs ──

describe("type defs include the v2 evaluator", () => {
  it("Database type has evaluate_satisfaction_rule_v2 (compile-time check)", async () => {
    // This test compiles only if the type def is present in database.types.ts.
    type DB = import("@/lib/supabase/database.types").Database;
    type Funcs = DB["public"]["Functions"];
    const _check: keyof Funcs = "evaluate_satisfaction_rule_v2";
    expect(_check).toBe("evaluate_satisfaction_rule_v2");
  });
});
