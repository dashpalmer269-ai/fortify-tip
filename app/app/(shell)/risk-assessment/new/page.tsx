import { getAppSession, assertActive } from "@/lib/auth/session";
import { RISK_QUESTIONS } from "@/lib/compliance/risk-questions";
import PageHeader from "@/components/ui/PageHeader";
import RiskWizard from "./RiskWizard";

export const dynamic = "force-dynamic";

export default async function NewRiskAssessmentPage() {
  const session = await getAppSession();
  assertActive(session);

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
