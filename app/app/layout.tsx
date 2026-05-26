import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";

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

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] flex">
      <Sidebar
        practiceName={session.membership.practice_name}
        role={session.membership.role}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userEmail={session.user.email ?? ""} role={session.membership.role} />
        <main className="flex-1 overflow-y-auto page-enter">{children}</main>
      </div>
    </div>
  );
}
