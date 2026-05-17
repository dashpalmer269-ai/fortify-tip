import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import StarfieldBackground from "@/components/StarfieldBackground";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // Special-case: onboarding routes render without the sidebar
  // (handled by their own layouts below). Otherwise, no practice yet → onboarding.
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex">
        {session.membership && (
          <Sidebar
            practiceName={
              (session.membership.practices as unknown as { name: string } | null)?.name ?? "Practice"
            }
          />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            userEmail={session.user.email ?? ""}
            role={session.membership?.role ?? "owner"}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
