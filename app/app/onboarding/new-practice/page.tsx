import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import NewPracticeForm from "./NewPracticeForm";

export const dynamic = "force-dynamic";

export default async function NewPracticePage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // If the user already belongs to a practice, skip onboarding.
  if (session.membership) redirect("/app");

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-violet-400 mb-2">Step 1 of 2</p>
        <h1 className="text-3xl font-bold text-white mb-2">Tell us about your practice</h1>
        <p className="text-gray-400">
          This becomes the workspace your team logs into. You can change any of these settings later.
        </p>
      </div>

      <NewPracticeForm userEmail={session.user.email ?? ""} />
    </div>
  );
}
