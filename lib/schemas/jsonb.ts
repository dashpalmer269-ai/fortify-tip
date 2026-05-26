/**
 * Zod schemas for our JSONB columns.
 *
 * The generated `Database` type leaves JSONB as `Json | null`, which is
 * effectively `any`. These schemas reinstate type safety: parse at the
 * boundary, trust the parsed value past it.
 *
 *   const profile = await db.from("user_profiles").select("primary_address").single();
 *   const address = PrimaryAddressSchema.nullable().parse(profile?.primary_address);
 *   // address is now `PrimaryAddress | null`
 */

import { z } from "zod";

/** user_profiles.primary_address — also used by the standard onboarding form. */
export const PrimaryAddressSchema = z.object({
  street_1: z.string().min(1),
  street_2: z.string().nullable().optional(),
  city: z.string().min(1),
  region: z.string().min(1),
  postal_code: z.string().min(1),
});
export type PrimaryAddress = z.infer<typeof PrimaryAddressSchema>;

/**
 * audit_logs.metadata — discriminated by `action`. Add a new variant here
 * when you add a new audit-log action; the discriminated union forces the
 * payload shape to be documented in one place.
 *
 * Unknown actions are still accepted via the catch-all so we don't reject
 * historical audit entries when actions are renamed.
 */
const OnboardingCompletedMeta = z.object({
  action: z.literal("onboarding.completed").optional(),
  plan: z.string().optional(),
  employee_range: z.string().optional(),
  location_count: z.number().int().optional(),
  safeguards_mode: z.string().optional(),
});
const RequestCreatedMeta = z.object({
  action: z.literal("request.created").optional(),
  full_name: z.string().optional(),
  job_title: z.string().optional(),
  claimed_admin_name: z.string().optional(),
});
const RequestDecidedMeta = z.object({
  action: z.union([z.literal("request.approved"), z.literal("request.denied")]).optional(),
  assigned_role: z.string().optional(),
  requester_name: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
const TeamNameUpdatedMeta = z.object({
  action: z.literal("team.name_updated").optional(),
  new_name: z.string().optional(),
});
const PolicyDraftedMeta = z.object({
  action: z.literal("policy.drafted_by_ai").optional(),
  title: z.string().optional(),
  framework: z.string().optional(),
});
const CatchAllMeta = z.record(z.string(), z.unknown());

export const AuditMetadataSchema = z.union([
  OnboardingCompletedMeta,
  RequestCreatedMeta,
  RequestDecidedMeta,
  TeamNameUpdatedMeta,
  PolicyDraftedMeta,
  CatchAllMeta,
]);
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

/**
 * Forgiving parse — returns the parsed value or null on shape mismatch.
 * Use when reading historical rows where the shape may not match the
 * current schema (e.g. an audit log entry written under an old version).
 */
export function parseJsonb<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } },
  value: unknown
): T | null {
  if (value == null) return null;
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
