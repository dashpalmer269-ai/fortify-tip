"use client";

import type { StepKey } from "./types";

const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "information",   label: "Information",   short: "01" },
  { key: "fortification", label: "Fortification", short: "02" },
  { key: "safeguards",    label: "Safeguards",    short: "03" },
  { key: "payment",       label: "Payment",       short: "04" },
];

interface Props {
  current: StepKey;
  furthest: StepKey;          // furthest step user has reached (for backward nav allow)
  onJump: (s: StepKey) => void;
}

const ORDER: StepKey[] = ["information", "fortification", "safeguards", "payment"];

function rank(s: StepKey): number {
  return ORDER.indexOf(s);
}

export default function Stepper({ current, furthest, onJump }: Props) {
  return (
    <nav aria-label="Onboarding progress" className="mb-12">
      <ol className="flex items-center justify-between gap-3 sm:gap-6">
        {STEPS.map((s, idx) => {
          const isCurrent = s.key === current;
          const isCompleted = rank(s.key) < rank(furthest);
          const isReachable = rank(s.key) <= rank(furthest);
          const State = isCurrent ? "current" : isCompleted ? "done" : "future";

          return (
            <li key={s.key} className="flex-1 flex items-center min-w-0">
              <button
                onClick={() => isReachable && onJump(s.key)}
                disabled={!isReachable}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-3 min-w-0 text-left transition-opacity ${
                  isReachable ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-40"
                }`}
              >
                <span
                  className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center font-mono text-[10px] font-semibold tabular-nums transition-all ${
                    State === "current"
                      ? "text-white border-violet-400 bg-violet-500/20"
                      : State === "done"
                      ? "text-violet-300 border-violet-500/40 bg-violet-500/10"
                      : "text-[var(--color-quaternary)] border-[var(--color-border-default)]"
                  }`}
                  style={State === "current" ? { boxShadow: "0 0 14px rgba(139,92,246,0.5)" } : undefined}
                >
                  {State === "done" ? "✓" : s.short}
                </span>
                <span
                  className={`hidden sm:block font-mono text-[10px] uppercase tracking-[0.3em] truncate ${
                    State === "current"
                      ? "text-[var(--color-primary)]"
                      : State === "done"
                      ? "text-violet-300/80"
                      : "text-[var(--color-quaternary)]"
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <span
                  className={`flex-1 h-px mx-3 sm:mx-5 transition-colors ${
                    rank(s.key) < rank(furthest)
                      ? "bg-violet-500/40"
                      : "bg-[var(--color-border-default)]"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
