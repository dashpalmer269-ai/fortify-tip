import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InviteTeamPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-violet-400 mb-2">Step 2 of 2</p>
        <h1 className="text-3xl font-bold text-white mb-2">Invite your team</h1>
        <p className="text-gray-400">
          Add the people who&apos;ll help maintain compliance. You can always add more later.
        </p>
      </div>

      <InviteForm practiceId={session.membership.practice_id} />

      <div className="mt-8 text-center">
        <Link href="/app" className="text-sm text-gray-500 hover:text-white transition-colors">
          Skip for now →
        </Link>
      </div>
    </div>
  );
}
