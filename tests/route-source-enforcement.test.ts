/**
 * Route-source enforcement tests.
 *
 * Rather than only exercising the requirePracticeAccess() helper in
 * isolation, these read the ACTUAL route handler source and assert each
 * protected route wires the gate in. This catches the regression where a
 * new mutating route ships without an access check — the failure the
 * helper-only tests could not detect.
 *
 * Also pins the policy-acknowledgment authorization fix: the route must
 * NOT forward a caller-supplied user id; identity is derived from
 * auth.uid() inside the acknowledge_policy RPC (migration 045).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/**
 * Every paid-value mutating route — grouped by the area the reviewer asked
 * us to cover. Each MUST call requirePracticeAccess.
 */
const GATED_ROUTES: Record<string, string[]> = {
  evidence: [
    "app/api/evidence/upload/route.ts",
    "app/api/evidence/finalize/route.ts",
    "app/api/evidence/attest/route.ts",
  ],
  reports: ["app/api/reports/generate/route.ts", "app/api/risk-assessment/route.ts"],
  integrations: [
    "app/api/integrations/m365/connect/route.ts",
    "app/api/integrations/google/connect/route.ts",
    "app/api/integrations/okta/connect/route.ts",
    "app/api/integrations/aws/connect/route.ts",
    "app/api/integrations/docusign/connect/route.ts",
  ],
  tasks: ["app/api/tasks/route.ts", "app/api/tasks/[id]/route.ts"],
  screenings: [
    "app/api/screening/preliminary/route.ts",
    "app/api/screening/vendor/route.ts",
    "app/api/screening/[id]/override/route.ts",
    "app/api/screening/[id]/verify/route.ts",
  ],
  training: ["app/api/training/[id]/complete/route.ts"],
  policies: ["app/api/policies/generate/route.ts", "app/api/policies/[id]/acknowledge/route.ts"],
  attestations: ["app/api/attestations/route.ts", "app/api/attestations/[id]/sign/route.ts"],
  team: [
    "app/api/team/add/route.ts",
    "app/api/team/role/route.ts",
    "app/api/team/remove/route.ts",
    "app/api/team/name/route.ts",
    "app/api/team/requests/[id]/route.ts",
    "app/api/invites/queue/route.ts",
  ],
};

describe("protected routes wire the access gate in source", () => {
  for (const [area, routes] of Object.entries(GATED_ROUTES)) {
    for (const route of routes) {
      it(`${area}: ${route} calls requirePracticeAccess`, () => {
        const src = read(route);
        expect(src).toContain("requirePracticeAccess");
        // It must be both imported and invoked (a stray comment isn't enough).
        expect(src).toMatch(/requirePracticeAccess\s*\(/);
      });
    }
  }
});

/**
 * The carve-out routes — documented as intentionally NOT gated. If one of
 * these ever GAINS a gate, that's a product decision to revisit (and this
 * test should be updated), not a silent change.
 */
const UNGATED_BY_DESIGN = [
  "app/api/billing/checkout/route.ts", // expired demos must be able to subscribe
  "app/api/team/leave/route.ts", // a user must always be able to leave
  "app/api/practice/delete/route.ts", // owner can always delete
  "app/api/auth/signup/route.ts", // pre-account
];

describe("carve-out routes remain ungated by design", () => {
  for (const route of UNGATED_BY_DESIGN) {
    it(`${route} does not call requirePracticeAccess`, () => {
      expect(read(route)).not.toContain("requirePracticeAccess(");
    });
  }
});

describe("policy-ack authorization: identity is server-derived, never caller-supplied", () => {
  const src = read("app/api/policies/[id]/acknowledge/route.ts");

  it("calls the acknowledge_policy RPC", () => {
    expect(src).toContain('rpc("acknowledge_policy"');
  });

  it("does NOT pass a caller-supplied user id to the RPC", () => {
    // The hardened signature is acknowledge_policy(p_policy_id) only.
    expect(src).not.toContain("p_user_id");
  });

  it("derives identity from the authed session, not the request body", () => {
    // The route resolves the session and passes only the policy id; the
    // user is auth.uid() inside the SECURITY DEFINER function.
    expect(src).toContain("getAppSession");
    expect(src).toContain("p_policy_id");
  });
});

describe("migration 045 hardening is present in source", () => {
  const migFull = read("supabase/migrations/045_security_hardening_and_evaluator_fix.sql");
  // Strip line comments so negative assertions test executable SQL, not the
  // explanatory header that necessarily names the columns being removed.
  const migCode = migFull
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("acknowledge_policy derives the user from auth.uid()", () => {
    expect(migCode).toContain("v_user uuid := auth.uid()");
    expect(migCode).toContain("drop function if exists acknowledge_policy(uuid, uuid)");
  });

  it("every hardened SECURITY DEFINER function is present", () => {
    for (const fn of [
      "acknowledge_policy",
      "redeem_invite_code",
      "public.user_is_practice_member",
      "public.user_is_practice_admin",
    ]) {
      expect(migCode).toContain(`function ${fn}`);
    }
    expect(migCode).toContain("set search_path = public, pg_temp");
  });

  it("reviewer approval uses real review fields, not a submitter count", () => {
    expect(migCode).toContain("review_status = 'approved'");
    expect(migCode).toContain("reviewed_by");
  });

  it("executable SQL no longer references non-existent practice_evidence columns", () => {
    expect(migCode).not.toContain("pe.source");
    expect(migCode).not.toContain("pe.evidence_type");
    expect(migCode).not.toContain("collected_by_user_id");
  });
});
