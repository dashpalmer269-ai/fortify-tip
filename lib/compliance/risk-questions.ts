/**
 * HIPAA-focused risk assessment questionnaire.
 * Each question is keyed; answers are stored in risk_assessments.answers as
 * a JSON map of {key: answer}. The wizard renders questions in order; the AI
 * scoring function reads the same keys.
 */
export interface RiskQuestion {
  key: string;
  category: string;
  question: string;
  options: Array<{ value: string; label: string; risk_weight: number }>;
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    key: "mfa_coverage",
    category: "Access Control",
    question: "What percentage of user accounts with PHI access have MFA enforced?",
    options: [
      { value: "100", label: "100%", risk_weight: 0 },
      { value: "75_99", label: "75–99%", risk_weight: 3 },
      { value: "50_74", label: "50–74%", risk_weight: 6 },
      { value: "under_50", label: "Under 50%", risk_weight: 10 },
      { value: "unknown", label: "Don’t know", risk_weight: 8 },
    ],
  },
  {
    key: "ephi_encryption_at_rest",
    category: "Encryption",
    question: "Is ePHI encrypted at rest on all workstations, servers, and backups?",
    options: [
      { value: "all", label: "Yes, everywhere", risk_weight: 0 },
      { value: "partial", label: "Some systems only", risk_weight: 6 },
      { value: "none", label: "No", risk_weight: 10 },
      { value: "unknown", label: "Don’t know", risk_weight: 8 },
    ],
  },
  {
    key: "ephi_encryption_in_transit",
    category: "Encryption",
    question: "Is ePHI encrypted in transit (TLS 1.2+) when sent outside your network?",
    options: [
      { value: "always", label: "Always", risk_weight: 0 },
      { value: "usually", label: "Most of the time", risk_weight: 4 },
      { value: "sometimes", label: "Sometimes — depends on the recipient", risk_weight: 8 },
      { value: "no", label: "No, or unknown", risk_weight: 10 },
    ],
  },
  {
    key: "audit_logging",
    category: "Monitoring",
    question: "Are audit logs enabled on systems holding ePHI, and reviewed regularly?",
    options: [
      { value: "enabled_reviewed", label: "Yes, both", risk_weight: 0 },
      { value: "enabled_not_reviewed", label: "Enabled, but not reviewed", risk_weight: 4 },
      { value: "not_enabled", label: "Not enabled or unknown", risk_weight: 10 },
    ],
  },
  {
    key: "backup_test",
    category: "Continuity",
    question: "When did you last successfully test restoring from backup?",
    options: [
      { value: "lt_90", label: "Within the last 90 days", risk_weight: 0 },
      { value: "lt_year", label: "Within the last year", risk_weight: 3 },
      { value: "over_year", label: "More than a year ago", risk_weight: 7 },
      { value: "never", label: "Never tested, or don’t know", risk_weight: 10 },
    ],
  },
  {
    key: "workforce_training_current",
    category: "Training",
    question: "What share of workforce members have completed HIPAA training in the last 12 months?",
    options: [
      { value: "100", label: "100%", risk_weight: 0 },
      { value: "75_99", label: "75–99%", risk_weight: 3 },
      { value: "under_75", label: "Under 75%", risk_weight: 7 },
      { value: "no_program", label: "No formal training program", risk_weight: 10 },
    ],
  },
  {
    key: "baa_coverage",
    category: "Vendor Risk",
    question: "Do you have a signed BAA on file for every vendor that touches ePHI?",
    options: [
      { value: "all", label: "Yes, all of them", risk_weight: 0 },
      { value: "most", label: "Most — a few are missing or pending", risk_weight: 5 },
      { value: "some", label: "Some — many vendors lack a BAA", risk_weight: 9 },
      { value: "unknown", label: "Not sure what vendors qualify", risk_weight: 10 },
    ],
  },
  {
    key: "risk_analysis_recency",
    category: "Governance",
    question: "When did you last conduct a documented HIPAA risk analysis?",
    options: [
      { value: "lt_year", label: "Within the last year", risk_weight: 0 },
      { value: "1_2_years", label: "1–2 years ago", risk_weight: 5 },
      { value: "over_2_years", label: "Over 2 years ago", risk_weight: 9 },
      { value: "never", label: "Never, or don’t know", risk_weight: 10 },
    ],
  },
  {
    key: "incident_response_plan",
    category: "Incident Response",
    question: "Do you have a written incident-response plan that staff have been trained on?",
    options: [
      { value: "yes_trained", label: "Yes — written and rehearsed", risk_weight: 0 },
      { value: "yes_untrained", label: "Written, but not trained or tested", risk_weight: 5 },
      { value: "no", label: "No formal plan", risk_weight: 9 },
    ],
  },
  {
    key: "phishing_recent_incident",
    category: "Incident History",
    question: "Has your practice had a phishing, ransomware, or breach incident in the last 24 months?",
    options: [
      { value: "no", label: "No", risk_weight: 0 },
      { value: "attempted", label: "Attempted but no impact", risk_weight: 2 },
      { value: "minor", label: "Yes, minor", risk_weight: 6 },
      { value: "major", label: "Yes, significant", risk_weight: 10 },
    ],
  },
];

export function computeBaselineRiskScore(answers: Record<string, string>): number {
  let total = 0;
  for (const q of RISK_QUESTIONS) {
    const answer = answers[q.key];
    const opt = q.options.find((o) => o.value === answer);
    total += opt?.risk_weight ?? 0;
  }
  // Normalize to 0-100 using the maximum possible score (sum of max risk weights).
  const maxPossible = RISK_QUESTIONS.reduce(
    (s, q) => s + Math.max(...q.options.map((o) => o.risk_weight)),
    0
  );
  return Math.round((total / maxPossible) * 100);
}
