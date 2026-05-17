"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RiskQuestion } from "@/lib/compliance/risk-questions";

export default function RiskWizard({
  practiceId,
  questions,
}: {
  practiceId: string;
  questions: RiskQuestion[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = Object.keys(answers).length;
  const total = questions.length;
  const allAnswered = answered === total;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId, framework: "HIPAA", answers }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to submit.");
        return;
      }
      router.push(`/app/risk-assessment/${body.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>
            <span className="text-white font-medium">{answered}</span> of {total} answered
          </span>
          <span>{Math.round((answered / total) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{
              width: `${(answered / total) * 100}%`,
              boxShadow: "0 0 10px rgba(139,92,246,0.6)",
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => {
          const currentAnswer = answers[q.key];
          return (
            <div
              key={q.key}
              className={`glass-card rounded-2xl p-5 transition-all ${
                currentAnswer ? "" : "opacity-90"
              }`}
              style={{ boxShadow: currentAnswer ? "0 0 18px rgba(139,92,246,0.18)" : undefined }}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-violet-300 mt-0.5 font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{q.category}</p>
                  <p className="text-white text-sm font-medium leading-snug">{q.question}</p>
                </div>
              </div>
              <div className="space-y-2 pl-9">
                {q.options.map((opt) => {
                  const isSelected = currentAnswer === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        isSelected
                          ? "bg-violet-500/15 text-white"
                          : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.key}
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.value }))}
                        className="accent-violet-500"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-8 sticky bottom-6 z-10">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 transition-colors"
          style={{ boxShadow: "0 0 24px rgba(139,92,246,0.4)" }}
        >
          {submitting
            ? "Analyzing with AI…"
            : allAnswered
            ? "Submit assessment → AI executive summary"
            : `Answer all ${total} questions to continue`}
        </button>
        {!allAnswered && (
          <p className="text-xs text-gray-600 text-center mt-2">
            {total - answered} remaining
          </p>
        )}
      </div>
    </div>
  );
}
