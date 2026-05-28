"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  async function complete(task: TaskItem) {
    // Policy-ack tasks resolve by acknowledging the policy, not marking done.
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
        return (
          <Card key={task.id}>
            <CardBody className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: tone.dot }}
                  title={tone.label}
                />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-primary)] truncate">{task.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mt-0.5">
                    {tone.label}
                    {task.due_date && (
                      <span className={overdue ? "text-[var(--color-danger)] ml-2" : "text-[var(--color-tertiary)] ml-2"}>
                        {overdue ? "Overdue · " : "Due "}
                        {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {showAssignee && task.assignee_email && (
                      <span className="text-[var(--color-tertiary)] ml-2">· {task.assignee_email}</span>
                    )}
                  </p>
                </div>
              </div>
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
          </Card>
        );
      })}
    </div>
  );
}
