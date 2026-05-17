import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import { RISK_QUESTIONS } from "@/lib/compliance/risk-questions";
import RiskWizard from "./RiskWizard";

export const dynamic = "force-dynamic";

export default async function NewRiskAssessmentPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">HIPAA risk analysis</p>
        <h1 className="text-3xl font-bold text-white">New assessment</h1>
        <p className="text-sm text-gray-500 mt-2">
          {RISK_QUESTIONS.length} questions · About 5 minutes · You can change answers later before submitting.
        </p>
      </div>

      <RiskWizard
        practiceId={session.membership.practice_id}
        questions={RISK_QUESTIONS}
      />
    </div>
  );
}
