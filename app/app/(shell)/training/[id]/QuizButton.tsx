"use client";

/**
 * QuizButton — the gate at the bottom of every training module page.
 *
 * Replaces the older "I have read this" checkbox with a real 10-question
 * multiple choice quiz. Score >= 80% records the completion via the
 * existing /api/training/[id]/complete endpoint (unchanged); score < 80%
 * shows the right answers and lets the user retake.
 *
 * Already-completed-within-expiry state matches the old behavior: a green
 * info card showing the completion date + expiry.
 *
 * Quiz content is stored as a constant in this file (Record<module_type,
 * Question[]>) so adding a new module's quiz is a single PR with no schema
 * changes. Questions are based on the official HHS / OCR training material
 * the markdown content points the learner at.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Question {
  question: string;
  options: string[]; // exactly 4
  correct: number;   // index into options
}

const QUIZ_QUESTIONS: Record<string, Question[]> = {
  hipaa_awareness: [
    { question: "What does ePHI stand for?",
      options: ["Electronic Protected Health Information","Encrypted Patient Health Index","Electronic Privacy and HIPAA Information","Employer Protected Health Insurance"],
      correct: 0 },
    { question: "The HIPAA Security Rule applies to which type of information?",
      options: ["All patient information in any format","Only paper records","Electronic protected health information only","Verbal communications about patients"],
      correct: 2 },
    { question: "How often must a covered entity conduct a risk analysis?",
      options: ["Once when they open","Every 5 years","Ongoing — whenever systems or operations change","Only after a breach"],
      correct: 2 },
    { question: "Which is an example of a technical safeguard?",
      options: ["Locking a filing cabinet","Multi-factor authentication","Training new employees","Signing a BAA"],
      correct: 1 },
    { question: "What is the minimum necessary standard?",
      options: ["Use the least amount of equipment possible","Only access or share the minimum PHI needed for the task","Hire the fewest staff possible","Keep the smallest patient records"],
      correct: 1 },
    { question: "If you notice a potential security incident, what should you do?",
      options: ["Wait to see if it resolves itself","Tell a coworker but not management","Report it to your Security Officer immediately","Delete the evidence to avoid a breach report"],
      correct: 2 },
    { question: "What is a Business Associate Agreement (BAA)?",
      options: ["A contract between two competing practices","A contract requiring a vendor to protect PHI they handle on your behalf","A patient consent form","An insurance agreement"],
      correct: 1 },
    { question: "Which is NOT a required safeguard category under the Security Rule?",
      options: ["Administrative safeguards","Physical safeguards","Technical safeguards","Financial safeguards"],
      correct: 3 },
    { question: "How long must a covered entity retain security policies and records?",
      options: ["1 year","3 years","6 years","10 years"],
      correct: 2 },
    { question: "What agency enforces the HIPAA Security Rule?",
      options: ["The FBI","The FTC","HHS Office for Civil Rights (OCR)","The AMA"],
      correct: 2 },
  ],

  hipaa_privacy: [
    { question: "What does the HIPAA Privacy Rule primarily regulate?",
      options: ["Encryption standards for ePHI","Use and disclosure of Protected Health Information","Workplace injury reporting","Insurance billing codes"],
      correct: 1 },
    { question: "The \"minimum necessary\" standard requires that:",
      options: ["You use the smallest amount of office equipment possible","You use, request, or disclose only the minimum PHI needed for the purpose","You hire the minimum number of staff","You collect only one form of patient ID"],
      correct: 1 },
    { question: "Within how many days must a covered entity respond to a patient's request for access to their records?",
      options: ["7 days","14 days","30 days","60 days"],
      correct: 2 },
    { question: "Which of these is NOT considered \"Treatment, Payment, or Operations\" (TPO)?",
      options: ["Discussing treatment options with a specialist","Submitting an insurance claim","Internal quality assurance reviews","Marketing a third-party product to the patient"],
      correct: 3 },
    { question: "When is patient authorization typically REQUIRED before disclosing PHI?",
      options: ["For most marketing communications","For routine treatment discussions among providers","For billing the patient's insurance","For internal practice operations"],
      correct: 0 },
    { question: "What is the Notice of Privacy Practices (NPP)?",
      options: ["A consent form to bill the patient","A document explaining how the practice may use and disclose PHI and the patient's rights","The patient's insurance card","An internal HR policy"],
      correct: 1 },
    { question: "Which patient right is established by the HIPAA Privacy Rule?",
      options: ["Right to access their own PHI","Right to request amendment of their record","Right to an accounting of certain disclosures","All of the above"],
      correct: 3 },
    { question: "A patient asks the practice to restrict disclosure of a specific item to their insurer. The practice:",
      options: ["Must always agree","May agree, but is not always required to","Must refuse","May only agree if the doctor signs off"],
      correct: 1 },
    { question: "Who must designate a Privacy Officer in a covered entity?",
      options: ["Only large hospitals","Every covered entity, regardless of size","Only multi-state practices","Only entities with electronic records"],
      correct: 1 },
    { question: "Which is true about psychotherapy notes under the Privacy Rule?",
      options: ["They have the same protections as regular PHI","They receive heightened protection — generally a separate authorization is required","They are not protected at all","Only the practice owner can access them"],
      correct: 1 },
  ],

  breach_notification: [
    { question: "Under the HIPAA Breach Notification Rule, a \"breach\" is generally defined as:",
      options: ["Any access to PHI","An impermissible acquisition, access, use, or disclosure of PHI that compromises its security or privacy","Only ransomware events","Only paper-record loss"],
      correct: 1 },
    { question: "Within how many days must a covered entity notify affected individuals of a breach of unsecured PHI?",
      options: ["14 days","30 days","60 days","90 days"],
      correct: 2 },
    { question: "When a breach affects 500 or more individuals, the covered entity must ALSO:",
      options: ["Notify the FBI","Notify HHS without unreasonable delay AND notify prominent media in the affected state/jurisdiction","Wait for the annual roll-up","Notify only by mail"],
      correct: 1 },
    { question: "For breaches affecting FEWER than 500 individuals, when must HHS be notified?",
      options: ["Within 30 days","Within 60 days","Within 90 days","Annually, no later than 60 days after the end of the calendar year"],
      correct: 3 },
    { question: "Which is NOT one of the four factors in the breach risk assessment?",
      options: ["The nature and extent of the PHI involved","The unauthorized person who used or received the PHI","Whether the PHI was actually acquired or viewed","The financial cost of remediation"],
      correct: 3 },
    { question: "If a covered entity has insufficient contact information for affected individuals, what alternative is required for substitute notice?",
      options: ["No substitute is required","Posting on the entity's website and/or major print or broadcast media","Word of mouth","Email only"],
      correct: 1 },
    { question: "When a Business Associate discovers a breach, who do they notify?",
      options: ["HHS only","The patients directly","The covered entity (their client), without unreasonable delay","The local police"],
      correct: 2 },
    { question: "Who has the burden of proof in demonstrating that notification was made (or that the event was not a breach)?",
      options: ["The patient","HHS","The covered entity (or business associate)","The patient's insurer"],
      correct: 2 },
    { question: "Where does HHS publish breaches affecting 500 or more individuals?",
      options: ["Internal records only","The public HHS \"Wall of Shame\" breach portal at ocrportal.hhs.gov","A subscription-only newsletter","Local newspapers only"],
      correct: 1 },
    { question: "Which of these statements about HIPAA civil penalties is most accurate?",
      options: ["The maximum penalty per violation is $100","All violations cap at $1,500","Penalties are tiered based on culpability, with significant per-violation and annual caps","Penalties only apply to breaches over 500 records"],
      correct: 2 },
  ],

  phishing: [
    { question: "According to HHS data, what is the most common starting point for healthcare breaches?",
      options: ["Stolen laptops","Phishing emails","Insider threats","Physical break-ins"],
      correct: 1 },
    { question: "A workforce member gets a \"Your password expires in 24 hours\" email with a link. They should:",
      options: ["Click the link immediately to renew","Hover over the link to see the real URL, and verify the sender domain — or navigate to the system directly","Reply to ask for confirmation","Forward to a coworker"],
      correct: 1 },
    { question: "Which is NOT a phishing tell-tale?",
      options: ["Urgency or fear in the message","Mismatched sender display name vs actual email","An expected attachment from a known colleague after a phone call","A request to share an MFA code"],
      correct: 2 },
    { question: "You clicked a suspicious link. What is the safest first action?",
      options: ["Wait to see if anything bad happens","Disconnect the device from the network and report to your Security Officer immediately","Try to \"fix it\" by logging back in to verify","Delete browser history and hope for the best"],
      correct: 1 },
    { question: "A caller claims to be from your EHR vendor and asks for your admin password to apply a critical patch. You should:",
      options: ["Provide it — patches must happen","Hang up and call the vendor back through a known phone number","Provide it but change it tomorrow","Provide it only if they prove they work there"],
      correct: 1 },
    { question: "What is \"business email compromise\" (BEC)?",
      options: ["Email service is offline","Attackers impersonate executives, vendors, or partners to trick staff into payments or sharing info","An IT helpdesk feature","A compliance certification"],
      correct: 1 },
    { question: "Which scenario is a typical voice (\"vishing\") attack on healthcare practices?",
      options: ["A patient calling to confirm an appointment","\"I'm the daughter of a new patient — please fax records to this number right now\"","An insurance company billing inquiry through your portal","A pharmacy verifying a prescription"],
      correct: 1 },
    { question: "MFA prompt bombing (push fatigue) is when:",
      options: ["Your MFA app shows weather notifications","Attackers trigger repeated MFA approval prompts hoping you tap \"Approve\" out of habit","Your phone runs out of battery","The system asks for MFA every day"],
      correct: 1 },
    { question: "What is the safest way to verify a payment-change request that arrives by email from a \"vendor\"?",
      options: ["Reply to the email","Click the link in the email and submit there","Call the vendor at a known phone number, not the one in the email","Trust the email if it has the company's logo"],
      correct: 2 },
    { question: "What's a reasonable cadence for phishing-simulation testing under HIPAA-aligned guidance?",
      options: ["Once at hire","Once per year","At least twice per year, with repeat clickers receiving additional training","Only after a real breach"],
      correct: 2 },
  ],
};

const PASS_THRESHOLD = 0.8; // 80% to pass

export default function QuizButton({
  moduleId,
  moduleType,
  moduleTitle,
  initialCompletedAt,
  initialExpiresOn,
}: {
  moduleId: string;
  moduleType: string;
  moduleTitle: string;
  initialCompletedAt: string | null;
  initialExpiresOn: string | null;
}) {
  const router = useRouter();
  const questions = QUIZ_QUESTIONS[moduleType] ?? [];

  const [answers, setAnswers] = useState<number[]>(() => new Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [expiresOn, setExpiresOn] = useState<string | null>(initialExpiresOn);

  const today = new Date().toISOString().slice(0, 10);
  const current = !!(completedAt && expiresOn && expiresOn >= today);

  // ── Already completed within expiry — show the same green card the old
  //    CompleteButton did. Prefer not surfacing the quiz at all here so
  //    learners can't accidentally "retake" their valid completion.
  if (current) {
    return (
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]">
        <strong className="text-[var(--color-success)]">Completed.</strong>{" "}
        You completed {moduleTitle} on{" "}
        {new Date(completedAt!).toLocaleString("en-US", { dateStyle: "long" })}
        {expiresOn && (
          <>
            {" "}· expires{" "}
            {new Date(expiresOn).toLocaleDateString("en-US", { dateStyle: "long" })}
          </>
        )}.
      </div>
    );
  }

  // ── Module without a configured question set
  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-tertiary)]">
        This module&apos;s quiz is not yet configured. Contact your administrator.
      </div>
    );
  }

  const passingScore = Math.ceil(questions.length * PASS_THRESHOLD);
  const answeredCount = answers.filter((a) => a !== -1).length;
  const allAnswered = answeredCount === questions.length;
  const passed = score !== null && score >= passingScore;

  async function recordCompletion() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/${moduleId}/complete`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        completed_at?: string;
        expires_on?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setCompletedAt(body.completed_at ?? new Date().toISOString());
      setExpiresOn(body.expires_on ?? null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!allAnswered) return;
    const correctCount = answers.reduce((count, ans, i) => {
      const q = questions[i];
      return q && ans === q.correct ? count + 1 : count;
    }, 0);
    setScore(correctCount);
    setSubmitted(true);
    if (correctCount >= passingScore) {
      // fire-and-display the API call in a useEffect-free manner
      recordCompletion();
    }
  }

  function reset() {
    setAnswers(new Array(questions.length).fill(-1));
    setSubmitted(false);
    setScore(null);
    setError(null);
  }

  function selectAnswer(qi: number, oi: number) {
    if (submitted) return; // can't re-answer during a frozen result state
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Quiz header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-400 mb-1">
          Quiz · {questions.length} questions · {passingScore} of {questions.length} to pass
        </p>
        <h2 className="text-lg font-medium text-[var(--color-primary)]">
          Verify your understanding
        </h2>
      </div>

      {/* Questions */}
      <ol className="space-y-4 list-none">
        {questions.map((q, qi) => {
          const userAnswer = answers[qi];
          const showRightAnswerHint = submitted && !passed;
          return (
            <li key={qi} className="glass-card rounded-xl p-5">
              <p className="text-sm text-[var(--color-primary)] mb-3 leading-relaxed">
                <span className="font-mono text-[12px] text-violet-400 mr-2">{qi + 1}.</span>
                {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const selected = userAnswer === oi;
                  const isCorrect = oi === q.correct;
                  const userPickedWrong = submitted && selected && !isCorrect;
                  const correctHighlight = showRightAnswerHint && isCorrect;
                  return (
                    <label
                      key={oi}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors border ${
                        submitted ? "cursor-default" : ""
                      } ${
                        selected
                          ? "bg-violet-500/10 border-violet-400/40"
                          : "border-transparent hover:bg-[var(--color-surface-raised)]"
                      } ${
                        userPickedWrong
                          ? "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/40"
                          : ""
                      } ${
                        correctHighlight
                          ? "bg-emerald-400/10 border-emerald-400/40"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        checked={selected}
                        disabled={submitted}
                        onChange={() => selectAnswer(qi, oi)}
                        className="mt-1 accent-violet-500"
                      />
                      <span className="text-[13px] text-[var(--color-secondary)] leading-relaxed flex-1">
                        {opt}
                      </span>
                      {correctHighlight && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 mt-1">
                          correct
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Action area */}
      {!submitted && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-[var(--color-quaternary)]">
            {allAnswered
              ? "All questions answered. Submit when you're ready."
              : `${answeredCount} of ${questions.length} answered`}
          </p>
          <Button onClick={submit} disabled={!allAnswered} variant="primary" size="sm">
            Submit quiz
          </Button>
        </div>
      )}

      {submitted && !passed && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-4 py-3 space-y-2">
          <p className="text-sm text-[var(--color-primary)]">
            <strong className="text-[var(--color-danger)]">
              You scored {score}/{questions.length}.
            </strong>{" "}
            You need {passingScore} to pass. The correct answers are highlighted in green
            above — review the material and try again.
          </p>
          <Button onClick={reset} variant="ghost" size="sm">
            Try again
          </Button>
        </div>
      )}

      {submitted && passed && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 space-y-2">
          <p className="text-sm text-[var(--color-primary)]">
            <strong className="text-[var(--color-success)]">
              Passed. Score: {score}/{questions.length}.
            </strong>{" "}
            {busy
              ? "Recording your completion…"
              : completedAt
              ? "Recorded. Refreshing…"
              : "Recording your completion."}
          </p>
          {error && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
              <Button onClick={recordCompletion} variant="primary" size="sm" loading={busy}>
                Retry save
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
