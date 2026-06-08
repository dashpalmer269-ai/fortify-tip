import { describe, expect, it } from "vitest";
import { generateInviteCode, hashInviteCode } from "@/lib/billing/invites";

describe("invite token helpers", () => {
  it("generateInviteCode returns 22-char base64url with no padding", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(code).not.toContain("=");
  });

  it("two consecutive codes don't collide (entropy sanity)", () => {
    const a = generateInviteCode();
    const b = generateInviteCode();
    expect(a).not.toBe(b);
  });

  it("hashInviteCode is 64 hex chars (sha256)", () => {
    const h = hashInviteCode("any-plaintext-here");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashInviteCode is deterministic for the same input", () => {
    const a = hashInviteCode("abc123def456");
    const b = hashInviteCode("abc123def456");
    expect(a).toBe(b);
  });

  it("hashInviteCode produces different outputs for different inputs", () => {
    const a = hashInviteCode("foo");
    const b = hashInviteCode("foo ");
    expect(a).not.toBe(b);
  });

  it("hashInviteCode known vector", () => {
    // Reference: echo -n "test" | sha256sum
    expect(hashInviteCode("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });
});
