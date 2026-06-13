"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { renderMarkdown } from "@/lib/sanitize";
import { Card, CardBody } from "@/components/ui/Card";

export interface TaskItem {
  id: string;
  title: string;
  source: string;
  status: string;
  severity: "critical" | "high" | "medium" | "low" | null;
  due_date: string | null;
  subject_ref: string | null;
  assignee_email?: string | null;
  control_key?: string | null;
  remediation_guide?: string | null;
  responsible_role?: string | null;
  /** Plain-English evidence that will clear this control once done. */
  evidence_to_clear?: string | null;
  /** Framework codes this task improves when completed. */
  frameworks_impacted?: string[];
  risk_score?: number;
}

const SEVERITY_TONE: Record<string, { dot: string; label: string }> = {
  critical: { dot: "#ef4444", label: "Critical" },
  high: { dot: "#f97316", label: "High" },
  medium: { dot: "#eab308", label: "Medium" },
  low: { dot: "#6b7280", label: "Low" },
};

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}

export default function TaskList({
  tasks,
  emptyMessage = "Nothing on your plate. You're all caught up.",
  showAssignee = false,
}: {
  tasks: TaskItem[];
  emptyMessage?: string;
  showAssignee?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  async function complete(task: TaskItem) {
    if (task.source === "policy_ack" && task.subject_ref) {
      router.push(`/app/policies/${task.subject_ref}`);
      return;
    }
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setHidden((h) => new Set(h).add(task.id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const visible = tasks.filter((t) => !hidden.has(t.id));

  if (visible.length === 0) {
    return (
      <Card>
        <CardBody className="py-8 text-center">
          <p className="text-sm text-[var(--color-tertiary)]">{emptyMessage}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {visible.map((task) => {
        const tone = SEVERITY_TONE[task.severity ?? "low"] ?? SEVERITY_TONE.low!;
        const overdue = isOverdue(task.due_date);
        const hasGuide = !!task.remediation_guide && task.remediation_guide.trim().length > 0;
        const hasEvidence = !!task.evidence_to_clear && task.evidence_to_clear.trim().length > 0;
        const hasFrameworks = !!task.frameworks_impacted && task.frameworks_impacted.length > 0;
        // Expand when there's anything useful to show, not just a guide.
        const hasDetail = hasGuide || hasEvidence || hasFrameworks;
        const isOpen = openId === task.id;
        return (
          <Card key={task.id} className="overflow-hidden">
            <CardBody className="flex items-center justify-between gap-4 py-3.5">
              <button
                type="button"
                onClick={() => hasDetail && setOpenId(isOpen ? null : task.id)}
                className={`flex items-start gap-3 min-w-0 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
                disabled={!hasDetail}
                aria-expanded={isOpen}
              >
                <span
                  className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: tone.dot }}
                  title={tone.label}
                />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-primary)] truncate">{task.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mt-0.5">
                    {tone.label}
                    {typeof task.risk_score === "number" && task.risk_score >= 6 && (
                      <span className="text-[var(--color-danger)] ml-2">· risk {task.risk_score.toFixed(1)}</span>
                    )}
                    {task.control_key && (
                      <span className="text-[var(--color-tertiary)] ml-2">· {task.control_key}</span>
                    )}
                    {task.responsible_role && (
                      <span className="text-[var(--color-tertiary)] ml-2">· {task.responsible_role}</span>
                    )}
                    {task.due_date && (
                      <span className={overdue ? "text-[var(--color-danger)] ml-2" : "text-[var(--color-tertiary)] ml-2"}>
                        {overdue ? "Overdue · " : "Due "}
                        {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {showAssignee && task.assignee_email && (
                      <span className="text-[var(--color-tertiary)] ml-2">· {task.assignee_email}</span>
                    )}
                    {hasDetail && (
                      <span className="text-[var(--color-accent)] ml-2">
                        {isOpen ? "Hide details" : "What to do →"}
                      </span>
                    )}
                  </p>
                </div>
              </button>
              <div className="shrink-0">
                {task.source === "policy_ack" && task.subject_ref ? (
                  <Link
                    href={`/app/policies/${task.subject_ref}`}
                    className="text-[12px] text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    Review &amp; acknowledge →
                  </Link>
                ) : (
                  <button
                    onClick={() => complete(task)}
                    disabled={busyId === task.id}
                    className="text-[12px] text-[var(--color-tertiary)] hover:text-[var(--color-success)] transition-colors disabled:opacity-50"
                  >
                    {busyId === task.id ? "Saving…" : "Mark done"}
                  </button>
                )}
              </div>
            </CardBody>
            {hasDetail && isOpen && (
              <div className="border-t border-[var(--color-border-subtle)] px-5 py-4 bg-[var(--color-surface)] space-y-4">
                {hasGuide && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-2">
                      How to fix
                    </div>
                    <div
                      className="task-remediation text-sm text-[var(--color-secondary)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(task.remediation_guide) }}
                    />
                  </div>
                )}

                {hasEvidence && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-1.5">
                      What proves it&apos;s fixed
                    </div>
                    <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                      {task.evidence_to_clear}
                    </p>
                  </div>
                )}

                {hasFrameworks && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-1.5">
                      Completing this improves
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {task.frameworks_impacted!.map((fw) => (
                        <span
                          key={fw}
                          className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-400/30"
                        >
                          {fw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
      <style>{`
        .task-remediation strong { color: var(--color-primary); font-weight: 600; }
        .task-remediation p { margin: 6px 0; }
        .task-remediation ol, .task-remediation ul { margin: 6px 0 6px 20px; }
        .task-remediation li { margin: 3px 0; }
        .task-remediation code { font-family: var(--font-mono, ui-monospace, monospace); background: var(--color-surface-raised); padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
      `}</style>
    </div>
  );
}
