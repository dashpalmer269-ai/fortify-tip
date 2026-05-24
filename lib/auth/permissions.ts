/**
 * Single source of truth for role-based permissions.
 * RLS in the database is the real gate; this file lets the UI mirror it
 * so we can hide/disable controls that would fail anyway.
 */

export type Role =
  | "owner"
  | "admin"
  | "compliance_officer"
  | "staff"
  | "auditor_readonly";

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
export function isOfficer(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "compliance_officer";
}

/** Roles that can manage team membership and practice settings. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Only the owner can do billing and destructive practice-level operations. */
export function isOwner(role: string | null | undefined): boolean {
  return role === "owner";
}

/** Roles that can be assigned by admins to a new team member. */
export const ASSIGNABLE_ROLES: Role[] = [
  "admin",
  "compliance_officer",
  "staff",
  "auditor_readonly",
];
