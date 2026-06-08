/**
 * Invite code helpers.
 *
 * Generates URL-safe, cryptographically random codes. The plaintext value
 * lives only in the URL shown to the granter at creation time — the
 * database stores sha256(code) on invite_codes.code_hash (migration 042).
 * Lookups hash the URL param and compare against code_hash.
 */
import { createHash, randomBytes } from "node:crypto";

/** 128 bits of entropy, 16 bytes → 22 base64url chars (no padding). */
export function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

export function hashInviteCode(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Default redemption window for a freshly generated code. */
export const DEFAULT_LINK_WINDOW_HOURS = 12;

/** Default demo duration after redemption. */
export const DEFAULT_ACCESS_MINUTES = 60;
