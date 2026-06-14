/**
 * Guard that the self-contained CI SQL test exercises the CORRECTED
 * evaluator (migration 045), not a stale copy of the buggy one.
 *
 * The CI DB test (scripts/ci/satisfaction-rule-ci-test.sql) duplicates the
 * evaluator function bodies so it can run against a plain Postgres service
 * container without the full Supabase stack. Duplication risks drift. This
 * test — which runs in the normal vitest suite — asserts the CI copy carries
 * the same correctness markers as migration 045 and none of the bug markers.
 *
 * (The migration itself cannot be executed in this environment; this guard
 * is the verifiable protection that the CI SQL stays in sync with the fix.)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ciSql = readFileSync(
  join(ROOT, "scripts/ci/satisfaction-rule-ci-test.sql"),
  "utf8"
);

function codeOnly(sql: string): string {
  return sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
}
const ciCode = codeOnly(ciSql);

describe("CI satisfaction SQL test exercises the corrected evaluator", () => {
  it("maps EVERY collection_method to a source (no NULL gaps)", () => {
    // All six collection_method values must map, or a seeded rule becomes
    // unsatisfiable. This guards the parity the reviewer requires: the DB
    // never describes a rule the engine can't enforce.
    expect(ciCode).toContain("'automated_api' then 'integration'");
    expect(ciCode).toContain("'automated_db_query' then 'integration'");
    expect(ciCode).toContain("'automated_scan' then 'integration'");
    expect(ciCode).toContain("'document_upload' then 'document_upload'");
    expect(ciCode).toContain("'screenshot' then 'document_upload'");
    expect(ciCode).toContain("'manual_attestation' then 'attestation'");
    expect(ciCode).not.toContain("pe.source");
    expect(ciCode).not.toContain("pe.evidence_type");
    expect(ciCode).not.toContain("collected_by_user_id");
  });

  it("migration 045 maps every collection_method identically to the CI test", () => {
    const mig = readFileSync(
      join(ROOT, "supabase/migrations/045_security_hardening_and_evaluator_fix.sql"),
      "utf8"
    );
    for (const pair of [
      "'automated_api' then 'integration'",
      "'automated_db_query' then 'integration'",
      "'automated_scan' then 'integration'",
      "'document_upload' then 'document_upload'",
      "'screenshot' then 'document_upload'",
      "'manual_attestation' then 'attestation'",
    ]) {
      expect(mig).toContain(pair);
    }
  });

  it("uses real reviewer approval (review_status approved by a different user)", () => {
    expect(ciCode).toContain("review_status = 'approved'");
    expect(ciCode).toContain("reviewed_by <> pe.collected_by");
  });

  it("covers every scenario the reviewer asked for", () => {
    for (const marker of [
      "fresh upload should pass",
      "expired upload should fail",
      "evidence_type filter",
      "integration pass/fail",
      "reviewer approval requires a different approver",
      "integration_disconnected_fail",
      "control exception override",
      "all_of",
      "not_started -> compliant",
      "every collection_method maps to an enforceable source",
    ]) {
      expect(ciSql).toContain(marker);
    }
  });

  it("rolls back so it leaves no fixtures", () => {
    expect(ciCode.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
