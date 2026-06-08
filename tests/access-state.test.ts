import { describe, expect, it } from "vitest";
import { computeAccessState, isAccessActive } from "@/lib/billing/access";

describe("computeAccessState", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  it("Stripe + active → active via stripe", () => {
    const s = computeAccessState({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "active",
    });
    expect(s).toEqual({ kind: "active", via: "stripe" });
  });

  it("Stripe + trialing → active via stripe", () => {
    const s = computeAccessState({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "trialing",
    });
    expect(s.kind).toBe("active");
  });

  it("Stripe + past_due → unpaid", () => {
    const s = computeAccessState({
      plan_source: "stripe",
      access_expires_at: null,
      billing_status: "past_due",
    });
    expect(s).toEqual({ kind: "unpaid" });
  });

  it("invite with future expiry → active via invite", () => {
    const s = computeAccessState({
      plan_source: "invite",
      access_expires_at: future,
      billing_status: null,
    });
    expect(s).toEqual({ kind: "active", via: "invite" });
  });

  it("invite with past expiry → demo_expired", () => {
    const s = computeAccessState({
      plan_source: "invite",
      access_expires_at: past,
      billing_status: null,
    });
    expect(s.kind).toBe("demo_expired");
    if (s.kind === "demo_expired") {
      expect(s.expired_at).toBe(past);
    }
  });

  it("invite with null expiry → unpaid (defensive)", () => {
    const s = computeAccessState({
      plan_source: "invite",
      access_expires_at: null,
      billing_status: null,
    });
    expect(s).toEqual({ kind: "unpaid" });
  });

  it("invite with bogus date → unpaid (defensive)", () => {
    const s = computeAccessState({
      plan_source: "invite",
      access_expires_at: "not-a-date",
      billing_status: null,
    });
    expect(s).toEqual({ kind: "unpaid" });
  });

  it("unpaid plan_source → unpaid regardless of expiry", () => {
    const s = computeAccessState({
      plan_source: "unpaid",
      access_expires_at: future,
      billing_status: null,
    });
    expect(s).toEqual({ kind: "unpaid" });
  });

  it("null plan_source → unpaid", () => {
    const s = computeAccessState({
      plan_source: null,
      access_expires_at: null,
      billing_status: null,
    });
    expect(s).toEqual({ kind: "unpaid" });
  });

  it("isAccessActive helper agrees with kind=active", () => {
    expect(
      isAccessActive({
        plan_source: "stripe",
        access_expires_at: null,
        billing_status: "active",
      })
    ).toBe(true);
    expect(
      isAccessActive({
        plan_source: "invite",
        access_expires_at: past,
        billing_status: null,
      })
    ).toBe(false);
  });
});
