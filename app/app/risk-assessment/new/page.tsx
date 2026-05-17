import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import { RISK_QUESTIONS } from "@/lib/compliance/risk-questions";
import PageHeader from "@/components/ui/PageHeader";
import RiskWizard from "./RiskWizard";

export const dynamic = "force-dynamic";

export default async function NewRiskAssessmentPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <PageHeader
        eyebrow="HIPAA risk analysis"
        title="New assessment"
        description={`${RISK_QUESTIONS.length} questions · About five minutes · Answers stay editable until you submit.`}
      />

      <RiskWizard
        practiceId={session.membership.practice_id}
        questions={RISK_QUESTIONS}
      />
    </div>
  );
}
