/**
 * Unit tests for requirePracticeAccess() — the helper every mutating route
 * uses to enforce the billing/demo gate.
 *
 * Mocks the supabase client at the smallest surface (one chainable maybeSingle
 * call) so the behavior contract can be exercised without a real DB. The
 * test cases trace the user-supplied checklist:
 *
 *   - expired invite → 402 demo_expired
 *   - unpaid → 402 unpaid
 *   - active stripe → ok
 *   - active invite → ok
 *   - not found → 404
 *
 * Route-level e2e tests (curl against a live signed-in session) sit outside
 * this file — that's the manual smoke-test loop in docs/access-gating.md.
 */
import { describe, expect, it } from "vitest";
import { requirePracticeAccess } from "@/lib/billing/require-access";

type PracticeRow = {
  plan_source: string | null;
  access_expires_at: string | null;
  billing_status: string | null;
};

function mockDb(row: PracticeRow | null, error: Error | null = null) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                async maybeSingle() {
                  return { data: row, error };
                },
              };
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

describe("requirePracticeAccess", () => {
  it("active Stripe subscription → ok", async () => {
    const db = mockDb({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "active",
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.kind).toBe("active");
  });

  it("active invite (future expiry) → ok", async () => {
    const db = mockDb({
      plan_source: "invite",
      access_expires_at: FUTURE,
      billing_status: null,
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(true);
  });

  it("expired invite → 402 with reason demo_expired", async () => {
    const db = mockDb({
      plan_source: "invite",
      access_expires_at: PAST,
      billing_status: null,
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      const body = await r.response.json();
      expect(body.reason).toBe("demo_expired");
      expect(body.expired_at).toBe(PAST);
      expect(body.next_step).toContain("Subscribe");
    }
  });

  it("unpaid (no plan_source) → 402 with reason unpaid", async () => {
    const db = mockDb({
      plan_source: "unpaid",
      access_expires_at: null,
      billing_status: null,
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      const body = await r.response.json();
      expect(body.reason).toBe("unpaid");
    }
  });

  it("Stripe past_due → 402 unpaid (downgrade)", async () => {
    const db = mockDb({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "past_due",
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      const body = await r.response.json();
      expect(body.reason).toBe("unpaid");
    }
  });

  it("Stripe trialing → ok", async () => {
    const db = mockDb({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "trialing",
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(true);
  });

  it("practice not found → 404", async () => {
    const db = mockDb(null);
    const r = await requirePracticeAccess(db, "p-missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(404);
  });

  it("DB error → 404 (defensive — we never want to admit access on unknown state)", async () => {
    const db = mockDb(null, new Error("connection refused"));
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(404);
  });

  it("invite with no expiry → unpaid (defensive — corrupt state)", async () => {
    const db = mockDb({
      plan_source: "invite",
      access_expires_at: null,
      billing_status: null,
    });
    const r = await requirePracticeAccess(db, "p-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const body = await r.response.json();
      expect(body.reason).toBe("unpaid");
    }
  });
});
