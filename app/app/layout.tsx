import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // Workspace is a calm, content-first environment.
  // Starfield and grain stay on marketing + auth; not here.
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] flex">
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
        <main className="flex-1 overflow-y-auto page-enter">{children}</main>
      </div>
    </div>
  );
}
