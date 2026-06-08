import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import { createServerClient } from "@/lib/supabase/server";
import { computeAccessState } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

/**
 * Status-based routing for /app/*. The discriminated union from
 * getAppSession() decides where the user actually belongs:
 *   - unauthenticated → /login
 *   - denied (standard) → /denied
 *   - pending (standard, onboarded) → /pending
 *   - no_practice → /app/onboarding (which then branches by account_type)
 *   - active → render the page with Sidebar + TopBar
 *
 * After session resolution we check the practice's access state. An
 * expired demo or unpaid subscription has ZERO access to the in-app
 * surface — no read-only view, no banner — the user is redirected to
 * /pricing?expired=demo (or unpaid). This is intentional: a demo grants
 * a controlled window of evaluation access and ends cleanly; staying in
 * the app post-expiry would muddy the value of the demo invitation.
 *
 * Per-page checks were removed; assertActive() inside each page is the
 * failsafe that catches anything that slips through.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();

  switch (session.kind) {
    case "unauthenticated":
      redirect("/login");
    case "denied":
      redirect("/denied");
    case "pending":
      redirect("/pending");
    case "no_practice":
      redirect("/app/onboarding");
    case "active":
      break;
  }

  // Read access state once per page render. If the practice has no active
  // subscription or its demo grant has lapsed, kick the user OUT of the
  // app entirely — they can subscribe or contact us, but they can't
  // continue browsing tenant data.
  const db = createServerClient();
  if (db) {
    const { data: practice } = await db
      .from("practices")
      .select("plan_source, access_expires_at, billing_status")
      .eq("id", session.membership.practice_id)
      .maybeSingle();
    if (practice) {
      const state = computeAccessState(practice);
      if (state.kind === "demo_expired") {
        redirect("/pricing?expired=demo");
      }
      if (state.kind === "unpaid") {
        redirect("/pricing?expired=unpaid");
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[var(--color-accent)] focus:text-white focus:text-sm focus:outline-none"
      >
        Skip to main content
      </a>
      <Sidebar
        practiceName={session.membership.practice_name}
        role={session.membership.role}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userEmail={session.user.email ?? ""} role={session.membership.role} />
        <main id="main-content" className="flex-1 overflow-y-auto page-enter">{children}</main>
      </div>
    </div>
  );
}
