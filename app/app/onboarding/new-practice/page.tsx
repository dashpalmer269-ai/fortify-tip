import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import NewPracticeForm from "./NewPracticeForm";

export const dynamic = "force-dynamic";

export default async function NewPracticePage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (session.membership) redirect("/app");

  return (
    <div className="px-8 py-10 max-w-xl mx-auto">
      <PageHeader
        eyebrow="Step 1 of 2"
        title="Tell us about your practice"
        description="This becomes the workspace your team logs into. You can change any of these later."
      />
      <NewPracticeForm userEmail={session.user.email ?? ""} />
    </div>
  );
}
