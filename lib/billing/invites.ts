/**
 * Invite code helpers.
 *
 * Generates URL-safe, cryptographically random codes.
 */
import { randomBytes } from "node:crypto";

/** 128 bits of entropy, 16 bytes → 22 base64url chars (no padding). */
export function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

/** Default redemption window for a freshly generated code. */
export const DEFAULT_LINK_WINDOW_HOURS = 12;

/** Default demo duration after redemption. */
export const DEFAULT_ACCESS_MINUTES = 60;
