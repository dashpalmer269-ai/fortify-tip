import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import type { Role } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

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
