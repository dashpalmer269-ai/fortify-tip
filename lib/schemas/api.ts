/**
 * Zod schemas for API request bodies.
 *
 * Use `parseBody(schema, request)` in route handlers — it gives you both
 * runtime validation AND inferred types in one call, replacing the
 * `(await req.json()) as { ... }` cast + hand-rolled `if (!body?.x)` chain.
 *
 *   const parsed = await parseBody(EmployeeOnboardingSchema, req);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.data;  // fully typed
 *
 * Schemas that accept user-supplied free text also run scanFieldsForPhi
 * on the parsed values; PHI returns HTTP 422 with the standard message.
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import { scanFieldsForPhi } from "@/lib/compliance/no-phi";
import { PrimaryAddressSchema } from "./jsonb";

/* ──────────────────────────────────────────────────────────────────────── *
 * Onboarding — administrator finalize
 * ──────────────────────────────────────────────────────────────────────── */
export const OnboardingFinalizeSchema = z.object({
  state: z.object({
    information: z.object({
      practice_name: z.string().min(1),
      description: z.string().min(1),
      employee_range: z.enum(["1-20", "21-50", "51+"]),
      location_count_range: z.enum(["1-2", "3-5", "5+"]),
      locations: z
        .array(
          z.object({
            label: z.string().nullable().optional(),
            street_1: z.string().min(1),
            street_2: z.string().nullable().optional(),
            city: z.string().min(1),
            region: z.string().min(1),
            postal_code: z.string().min(1),
          })
        )
        .min(1),
    }),
    fortification: z.object({
      current_status: z.enum([
        "starting_brand_new",
        "maintenance_needed",
        "transfer_from_other",
      ]),
      upcoming_audit_window: z.enum([
        "within_30_days",
        "within_60_days",
        "within_90_days",
        "beyond_90_days",
      ]),
    }),
    safeguards: z.object({
      mode: z.enum(["manual", "schedule"]),
      integrations: z.array(z.string()),
      assistance_date: z.string(),
      assistance_window: z.string(),
      assistance_phone: z.string(),
      assistance_notes: z.string(),
    }),
    payment: z.object({
      selected_plan: z.enum(["software", "full_service"]),
    }),
  }),
  existing_practice_id: z.string().uuid().nullable().optional(),
});
export type OnboardingFinalizeBody = z.infer<typeof OnboardingFinalizeSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Onboarding — standard (employee) submit
 * ──────────────────────────────────────────────────────────────────────── */
export const EmployeeOnboardingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  // Required as of 017 for exclusion screening at signup completion
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
  job_title: z.string().trim().min(1).max(120),
  phone: z.string().trim().nullable().optional(),
  pending_practice_name: z.string().trim().min(1).max(120),
  claimed_admin_name: z.string().trim().min(1).max(120),
  primary_address: PrimaryAddressSchema,
});
export type EmployeeOnboardingBody = z.infer<typeof EmployeeOnboardingSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Team — approve / deny request
 * ──────────────────────────────────────────────────────────────────────── */
export const RequestDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    denial_reason: z.string().optional(), // ignored
  }),
  z.object({
    action: z.literal("deny"),
    denial_reason: z.string().trim().max(500).optional(),
    role: z.string().optional(), // ignored
  }),
]);
export type RequestDecisionBody = z.infer<typeof RequestDecisionSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Team — rename a member
 * ──────────────────────────────────────────────────────────────────────── */
export const TeamRenameSchema = z.object({
  practice_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
});
export type TeamRenameBody = z.infer<typeof TeamRenameSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Policies — generate
 * ──────────────────────────────────────────────────────────────────────── */
export const PolicyGenerateSchema = z.object({
  practice_id: z.string().uuid(),
  framework: z.string().optional(),
  policy_type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
});
export type PolicyGenerateBody = z.infer<typeof PolicyGenerateSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Signup endpoint
 * ──────────────────────────────────────────────────────────────────────── */
export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  account_type: z.enum(["admin", "employee"]).optional(),
  // Optional — URL-safe demo invite code stashed into user_metadata so it
  // survives email-confirm. Validated again at redemption time.
  invite_code: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
});
export type SignupBody = z.infer<typeof SignupSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Notifications — mark read
 * ──────────────────────────────────────────────────────────────────────── */
export const NotificationsActionSchema = z.object({
  mark_all_read: z.boolean().optional(),
  ids: z.array(z.string().uuid()).optional(),
});
export type NotificationsActionBody = z.infer<typeof NotificationsActionSchema>;

/* ──────────────────────────────────────────────────────────────────────── *
 * Helper: parse + PHI scan + standardized error response
 * ──────────────────────────────────────────────────────────────────────── */
type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

interface ParseOptions {
  /** Field names to additionally run through scanFieldsForPhi after parsing. */
  phiFields?: string[];
}

/**
 * Parse and validate a JSON request body against a zod schema. Optionally
 * runs the No-PHI scan against named string fields. Returns a tagged
 * result the caller can short-circuit on.
 */
export async function parseBody<T extends z.ZodType>(
  schema: T,
  req: { json: () => Promise<unknown> },
  options: ParseOptions = {}
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      response: NextResponse.json({ error: msg }, { status: 400 }),
    };
  }

  if (options.phiFields?.length) {
    const data = parsed.data as Record<string, unknown>;
    const toScan: Record<string, string | null | undefined> = {};
    for (const field of options.phiFields) {
      const val = data[field];
      if (typeof val === "string") toScan[field] = val;
    }
    const phi = scanFieldsForPhi(toScan);
    if (phi) {
      return {
        ok: false,
        response: NextResponse.json({ error: phi.message }, { status: 422 }),
      };
    }
  }

  return { ok: true, data: parsed.data };
}
