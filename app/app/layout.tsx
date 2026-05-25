import { redirect } from "next/navigation";
import {
  getCurrentUserAndPractice,
  createAuthedServerClient,
} from "@/lib/supabase/server-auth";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import type { Role } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // Status-based access control. A user without practice membership might be
  // either (a) an admin mid-onboarding or (b) a standard user pending/denied.
  if (!session.membership) {
    const supabase = await createAuthedServerClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_type, status, onboarded_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    // Standard users get routed by their request status
    if (profile?.account_type === "employee") {
      if (profile.status === "approved") {
        // Shouldn't happen (would have membership) but failsafe: send to onboarding
        // for re-bootstrap rather than crashing here.
      } else if (profile.status === "denied") {
        redirect("/denied");
      } else if (profile.onboarded_at) {
        redirect("/pending");
      } else {
        redirect("/app/onboarding");
      }
    }
    // Admins (or anyone else without a profile) continue to onboarding
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] flex">
      {session.membership && (
        <Sidebar
          practiceName={
            (session.membership.practices as unknown as { name: string } | null)?.name ?? "Practice"
          }
          role={session.membership.role as Role}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userEmail={session.user.email ?? ""}
          role={session.membership?.role ?? "owner"}
        />
        <main className="flex-1 overflow-y-auto page-enter">{children}</main>
      </div>
    </div>
  );
}
