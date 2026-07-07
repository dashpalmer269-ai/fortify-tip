/**
 * Fortify-admin: invite code management.
 *
 * Server component that pre-checks the FORTIFY_ADMIN_EMAILS allowlist and
 * routes non-admins straight to the dashboard. The admin UX itself
 * (generate, list, copy-link, revoke) lives in InvitesClient.
 */
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { isFortifyAdmin } from "@/lib/billing/admin";
import InvitesClient from "./InvitesClient";

export const dynamic = "force-dynamic";

export default async function InvitesAdminPage() {
  const session = await getAppSession();
  if (session.kind === "unauthenticated") redirect("/login");
  if (session.kind !== "active") redirect("/app");

  if (!isFortifyAdmin(session.user.email)) {
    redirect("/app");
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-400 mb-2">
          Fortify admin
        </p>
        <h1 className="text-2xl font-bold text-white mb-2">Demo invite codes</h1>
        <p className="text-sm text-[var(--color-secondary)]">
          Generate single-use invite links. Each grants the recipient full Software-tier
          access for the duration you specify. Codes auto-expire in 12 hours if unredeemed
          (configurable per code).
        </p>
      </div>

      <InvitesClient />
    </div>
  );
}
