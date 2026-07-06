import { describe, it, expect } from "vitest";
import {
  generateTeamInviteToken,
  isInviteExpired,
  TEAM_INVITE_EXPIRY_DAYS,
} from "@/lib/billing/team-invites";
import { hashInviteCode } from "@/lib/billing/invites";
import { TeamInviteQueueSchema, TeamInviteRedeemSchema } from "@/lib/schemas/api";

describe("team invite tokens", () => {
  it("generates a URL-safe token whose hash matches sha256(token)", () => {
    const { token, token_hash } = generateTeamInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(token_hash).toBe(hashInviteCode(token));
    expect(token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateTeamInviteToken().token));
    expect(seen.size).toBe(50);
  });

  it("default expiry window is 14 days", () => {
    expect(TEAM_INVITE_EXPIRY_DAYS).toBe(14);
  });
});

describe("isInviteExpired", () => {
  const now = new Date("2026-07-06T12:00:00Z");

  it("false while expires_at is in the future", () => {
    expect(isInviteExpired({ expires_at: "2026-07-07T12:00:00Z" }, now)).toBe(false);
  });

  it("true once expires_at has passed", () => {
    expect(isInviteExpired({ expires_at: "2026-07-06T11:59:59Z" }, now)).toBe(true);
  });
});

describe("TeamInviteQueueSchema", () => {
  const practice_id = "3f0e8f1a-2b4c-4d6e-8f0a-1b2c3d4e5f60";

  it("lowercases and accepts a valid batch", () => {
    const parsed = TeamInviteQueueSchema.safeParse({
      practice_id,
      invites: [{ email: "Nurse.Kelly@Practice.COM", role: "staff" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.invites[0]?.email).toBe("nurse.kelly@practice.com");
  });

  it("rejects the owner role — ownership is transferred, never invited", () => {
    const parsed = TeamInviteQueueSchema.safeParse({
      practice_id,
      invites: [{ email: "a@b.com", role: "owner" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty and oversized batches", () => {
    expect(TeamInviteQueueSchema.safeParse({ practice_id, invites: [] }).success).toBe(false);
    const big = Array.from({ length: 21 }, (_, i) => ({ email: `u${i}@x.com`, role: "staff" }));
    expect(TeamInviteQueueSchema.safeParse({ practice_id, invites: big }).success).toBe(false);
  });

  it("rejects malformed emails", () => {
    const parsed = TeamInviteQueueSchema.safeParse({
      practice_id,
      invites: [{ email: "not-an-email", role: "staff" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("TeamInviteRedeemSchema", () => {
  it("accepts an empty body (email-match path)", () => {
    expect(TeamInviteRedeemSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a well-formed token and rejects junk", () => {
    expect(TeamInviteRedeemSchema.safeParse({ token: generateTeamInviteToken().token }).success).toBe(true);
    expect(TeamInviteRedeemSchema.safeParse({ token: "short" }).success).toBe(false);
    expect(TeamInviteRedeemSchema.safeParse({ token: "has spaces in it!!" }).success).toBe(false);
  });
});
