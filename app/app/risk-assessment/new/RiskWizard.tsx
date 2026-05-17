"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RiskQuestion } from "@/lib/compliance/risk-questions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
      if (!res.ok) { setError(body.error ?? "Failed to submit."); return; }
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
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-2">
          <span><span className="text-[var(--color-primary)]">{answered}</span> of {total}</span>
          <span className="tabular-nums">{Math.round((answered / total) * 100)}%</span>
        </div>
        <div className="h-px bg-[var(--color-border-subtle)] relative overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${(answered / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => {
          const currentAnswer = answers[q.key];
          return (
            <Card key={q.key} variant={currentAnswer ? "raised" : "default"}>
              <div className="px-5 py-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="font-mono text-[11px] text-[var(--color-tertiary)] tabular-nums mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] mb-1">
                      {q.category}
                    </p>
                    <p className="text-[var(--color-primary)] text-sm leading-snug">{q.question}</p>
                  </div>
                </div>
                <div className="pl-9 space-y-1">
                  {q.options.map((opt) => {
                    const isSelected = currentAnswer === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                          isSelected
                            ? "text-[var(--color-primary)] bg-[var(--color-surface-raised)]"
                            : "text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.key}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.value }))}
                          className="accent-[var(--color-accent)]"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-8 sticky bottom-6 z-10">
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered}
          loading={submitting}
          variant="primary"
          size="lg"
          className="w-full"
        >
          {allAnswered ? "Submit · AI generates summary" : `Answer all ${total} questions to continue`}
        </Button>
        {!allAnswered && (
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] text-center mt-2">
            {total - answered} remaining
          </p>
        )}
      </div>
    </div>
  );
}
