/**
 * Single source of truth for role-based permissions.
 * RLS in the database is the real gate; this file lets the UI mirror it
 * so we can hide/disable controls that would fail anyway.
 *
 * Roles are derived from the generated Database type — if a new role is
 * added to the `practice_users.role` CHECK constraint, this `Role` union
 * widens automatically and every `Record<Role, ...>` consumer below will
 * fail to compile until the new entry is added. Schema is the source of
 * truth; this file mirrors it without re-declaring.
 */

import type { Tables } from "@/lib/supabase/types";

export type Role = Tables<"practice_users">["role"];

/** Standard / employee onboarding lifecycle status. */
export type RequestStatus = Tables<"user_profiles">["status"];

/** Admin vs Standard account split chosen at signup. */
export type AccountType = Tables<"user_profiles">["account_type"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  compliance_officer: "Compliance Officer",
  staff: "Staff",
  auditor_readonly: "Auditor (read-only)",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control. Can manage billing and delete the practice.",
  admin: "Full administrative access except deleting the practice.",
  compliance_officer: "Manages compliance controls, evidence, policies, and reports.",
  staff: "Day-to-day workforce. Sees most of the workspace; limited write access.",
  auditor_readonly: "Read-only access for external auditors.",
};

/** Roles that can write compliance / evidence / vendors / reports. */
export function isOfficer(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "compliance_officer";
}

/** Roles that can manage team membership and practice settings. */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Only the owner can do billing and destructive practice-level operations. */
export function isOwner(role: Role | null | undefined): boolean {
  return role === "owner";
}

/**
 * Roles an admin can assign to a new team member. Owner is excluded because
 * ownership is transferred, not assigned. The `satisfies` clause verifies
 * every entry is a valid Role at compile time — adding a new role to the
 * DB will fail this file's typecheck if it isn't accounted for here.
 */
export const ASSIGNABLE_ROLES = [
  "admin",
  "compliance_officer",
  "staff",
  "auditor_readonly",
] as const satisfies readonly Role[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Runtime check that narrows an unknown string into an AssignableRole. */
export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
