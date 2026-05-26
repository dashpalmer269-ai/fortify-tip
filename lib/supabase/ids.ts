/**
 * Branded ID types.
 *
 * UUIDs of different kinds are runtime-identical strings but logically
 * distinct — a practice ID is not interchangeable with a user ID. TypeScript
 * treats them as the same `string`, which lets `.eq("user_id", practiceId)`
 * compile silently. In a multi-tenant system that swap can leak rows across
 * tenants.
 *
 * Branding makes mix-ups a compile error:
 *
 *   const practiceId: PracticeId = asPracticeId("...uuid...");
 *   db.from("practice_users").eq("user_id", practiceId);  // ❌ type error
 *
 * Branded types are zero-cost at runtime — they're plain strings with a
 * phantom type tag. Mint them at boundaries (URL params, request bodies,
 * DB query results) with the `as*` helpers, then trust them past that point.
 *
 * We don't brand DB row types from `database.types.ts` (those stay as
 * `string` to match what `supabase gen types` emits). Branding lives at
 * the application-code boundary.
 */

const PracticeIdBrand = Symbol("PracticeId");
const UserIdBrand = Symbol("UserId");
const PolicyIdBrand = Symbol("PolicyId");
const VendorIdBrand = Symbol("VendorId");
const ControlIdBrand = Symbol("ControlId");
const NotificationIdBrand = Symbol("NotificationId");

export type PracticeId = string & { readonly [PracticeIdBrand]: true };
export type UserId = string & { readonly [UserIdBrand]: true };
export type PolicyId = string & { readonly [PolicyIdBrand]: true };
export type VendorId = string & { readonly [VendorIdBrand]: true };
export type ControlId = string & { readonly [ControlIdBrand]: true };
export type NotificationId = string & { readonly [NotificationIdBrand]: true };

/** All IDs we brand. Useful for `Tables<T>["id"]` overrides. */
export type AnyBrandedId =
  | PracticeId
  | UserId
  | PolicyId
  | VendorId
  | ControlId
  | NotificationId;

/* ──────────────────────────────────────────────────────────────────────── *
 * Constructors — validate UUID shape and brand
 * ──────────────────────────────────────────────────────────────────────── */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function brand<T>(value: unknown, kind: string): T {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${kind}: expected a UUID, got ${JSON.stringify(value)}`);
  }
  return value as T;
}

export const asPracticeId = (v: unknown): PracticeId => brand<PracticeId>(v, "PracticeId");
export const asUserId = (v: unknown): UserId => brand<UserId>(v, "UserId");
export const asPolicyId = (v: unknown): PolicyId => brand<PolicyId>(v, "PolicyId");
export const asVendorId = (v: unknown): VendorId => brand<VendorId>(v, "VendorId");
export const asControlId = (v: unknown): ControlId => brand<ControlId>(v, "ControlId");
export const asNotificationId = (v: unknown): NotificationId =>
  brand<NotificationId>(v, "NotificationId");

/* ──────────────────────────────────────────────────────────────────────── *
 * Safe variants — return null instead of throwing
 * Use when the input may legitimately be missing/invalid (e.g. URL params
 * a user could fat-finger).
 * ──────────────────────────────────────────────────────────────────────── */

function tryBrand<T>(value: unknown): T | null {
  return typeof value === "string" && UUID_RE.test(value) ? (value as T) : null;
}

export const tryPracticeId = (v: unknown): PracticeId | null => tryBrand<PracticeId>(v);
export const tryUserId = (v: unknown): UserId | null => tryBrand<UserId>(v);
export const tryPolicyId = (v: unknown): PolicyId | null => tryBrand<PolicyId>(v);
export const tryVendorId = (v: unknown): VendorId | null => tryBrand<VendorId>(v);
export const tryControlId = (v: unknown): ControlId | null => tryBrand<ControlId>(v);
export const tryNotificationId = (v: unknown): NotificationId | null =>
  tryBrand<NotificationId>(v);

/* ──────────────────────────────────────────────────────────────────────── *
 * Equality helpers — for cases where TS already narrowed to a specific brand
 * but you have a `string` from somewhere and want to compare safely
 * ──────────────────────────────────────────────────────────────────────── */

export function idEquals<T extends AnyBrandedId>(a: T, b: T | string): boolean {
  return (a as string) === b;
}
