import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InviteTeamPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  return (
    <div className="px-8 py-10 max-w-xl mx-auto">
      <PageHeader
        eyebrow="Step 2 of 2"
        title="Invite your team"
        description="Add the people who'll help maintain compliance. You can always add more later."
      />
      <InviteForm practiceId={session.membership.practice_id} />
      <div className="mt-8 text-center">
        <Link href="/app" className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
          Skip for now →
        </Link>
      </div>
    </div>
  );
}
