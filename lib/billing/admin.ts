/**
 * "Fortify org admin" gate.
 *
 * The Fortify organization itself (i.e. you, as the operator) is not modeled
 * as a practice member — there's no schema field for it. Instead, the
 * allowlist of email addresses lives in the FORTIFY_ADMIN_EMAILS env var
 * (comma-separated). Routes that should only be callable by Fortify staff
 * (creating demo-invite codes, viewing all-tenant analytics, etc.) gate via
 * this helper.
 *
 * On config absence the gate fails closed — there is no "anyone is an admin"
 * fallback, deliberately.
 */
export function isFortifyAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.FORTIFY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}
