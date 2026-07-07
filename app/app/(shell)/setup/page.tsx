import Link from "next/link";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { loadSetupChecklist, type SetupStep } from "@/lib/setup/checklist";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

/**
 * Guided Setup Checklist — the "what do I do next" home for a practice
 * that's still getting audit-ready. Reads real practice state so each
 * item reflects what's actually been done, in plain language.
 */
export default async function SetupPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const checklist = await loadSetupChecklist(supabase, session.membership.practice_id);

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Getting started"
        title="Your setup checklist"
        description="Complete these steps to get your practice audit-ready. Fortify automates as much as possible — each step tells you exactly what to do and why it matters."
      />

      {/* Progress summary */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-[var(--color-secondary)]">
            {checklist.allComplete ? (
              <span className="text-[var(--color-success)] font-medium">
                All set up — your practice has completed every setup step.
              </span>
            ) : (
              <>
                <strong className="text-[var(--color-primary)]">
                  {checklist.completedCount} of {checklist.totalCount}
                </strong>{" "}
                steps complete
              </>
            )}
          </p>
          <span className="font-display text-2xl tabular-nums text-[var(--color-primary)]">
            {checklist.percentComplete}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${checklist.percentComplete}%`,
              background: checklist.allComplete ? "var(--color-success)" : "var(--color-accent)",
            }}
          />
        </div>

        {checklist.nextStep && (
          <div className="mt-5 pt-5 border-t border-[var(--color-border-subtle)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-400 mb-1">
              Do this next
            </p>
            <p className="text-[15px] text-[var(--color-primary)] font-medium mb-1">
              {checklist.nextStep.title}
            </p>
            <p className="text-[13px] text-[var(--color-secondary)] mb-3 leading-relaxed">
              {checklist.nextStep.whatToDo}
            </p>
            <Link
              href={checklist.nextStep.href}
              className="inline-block text-[12px] font-mono uppercase tracking-wider px-4 py-2 rounded-md bg-violet-500 text-white hover:bg-violet-400 transition-colors"
            >
              Go to {checklist.nextStep.title}
            </Link>
          </div>
        )}
      </Card>

      {/* Full step list */}
      <div className="space-y-3">
        {checklist.steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i + 1} />
        ))}
      </div>

      {/* Founder-assisted fallback — always available, never the default */}
      <Card className="p-6 mt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-2">
          Need a hand?
        </p>
        <p className="text-[14px] text-[var(--color-secondary)] leading-relaxed mb-4">
          Most practices complete setup on their own in about an hour. If you&apos;d rather have
          us walk you through it, we&apos;re glad to help — no pressure.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/app/help"
            className="text-[12px] font-mono uppercase tracking-wider px-4 py-2 rounded-md border border-[var(--color-border-default)] text-[var(--color-secondary)] hover:border-violet-400/40 hover:text-violet-400 transition-colors"
          >
            Visit Help Center
          </Link>
          <a
            href="mailto:support@fortifynow.xyz?subject=Request%20Fortify%20Review"
            className="text-[12px] font-mono uppercase tracking-wider px-4 py-2 rounded-md border border-[var(--color-border-default)] text-[var(--color-secondary)] hover:border-violet-400/40 hover:text-violet-400 transition-colors"
          >
            Request a Fortify Review
          </a>
        </div>
      </Card>
    </div>
  );
}

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  return (
    <Card className={`p-5 ${step.done ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-4">
        {/* Status dot */}
        <div
          className={`mt-0.5 w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold ${
            step.done
              ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/40"
              : "bg-[var(--color-surface)] text-[var(--color-tertiary)] border border-[var(--color-border-default)]"
          }`}
        >
          {step.done ? "✓" : index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[15px] font-medium text-[var(--color-primary)]">{step.title}</h3>
            <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-tertiary)]">
              {step.role}
            </span>
            {step.detail && (
              <span
                className={`font-mono text-[10px] ${
                  step.done ? "text-emerald-400" : "text-[var(--color-tertiary)]"
                }`}
              >
                · {step.detail}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[var(--color-secondary)] leading-relaxed mb-1">{step.why}</p>
          {!step.done && (
            <p className="text-[13px] text-[var(--color-primary)] leading-relaxed">
              <span className="text-[var(--color-tertiary)]">What to do: </span>
              {step.whatToDo}
            </p>
          )}
        </div>

        {!step.done && (
          <Link
            href={step.href}
            className="shrink-0 text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-md border border-violet-400/40 text-violet-400 hover:bg-violet-400/10 transition-colors self-center"
          >
            Start
          </Link>
        )}
      </div>
    </Card>
  );
}
