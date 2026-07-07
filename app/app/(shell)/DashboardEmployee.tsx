"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import TaskList, { type TaskItem } from "@/components/app/TaskList";

export default function DashboardEmployee({
  practiceName,
  fullName,
  jobTitle,
  userEmail,
  role,
  tasks,
}: {
  practiceName: string;
  fullName: string | null;
  jobTitle: string | null;
  userEmail: string;
  role: Role;
  tasks: TaskItem[];
}) {
  const firstName = fullName?.split(" ")[0] ?? userEmail.split("@")[0];
  const openCount = tasks.length;
  // Defer time-dependent computation to after mount so SSR + first client
  // render produce identical HTML. Server renders overdueCount = 0; client
  // recomputes once mounted. Avoids hydration mismatch on edge-case tasks
  // whose due_date crosses the SSR boundary.
  const [now, setNow] = useState<number | null>(null);
  // Post-mount initialization to keep SSR + first client render identical.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);
  const overdueCount = useMemo(() => {
    if (now === null) return 0;
    return tasks.filter((t) => t.due_date && new Date(t.due_date).getTime() < now).length;
  }, [now, tasks]);
  const standing = openCount === 0 ? "All clear" : overdueCount > 0 ? "Action needed" : "On track";
  const standingTone =
    openCount === 0 ? "var(--color-success)" : overdueCount > 0 ? "var(--color-danger)" : "var(--color-warning)";

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
          {practiceName}
        </p>
        <h1
          className="font-display text-[clamp(30px,4vw,44px)] text-[var(--color-primary)] leading-[1.05] mb-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          {openCount === 0 ? `You're all caught up, ${firstName}.` : `${firstName}, you have ${openCount} ${openCount === 1 ? "task" : "tasks"}.`}
        </h1>
        <p className="text-sm text-[var(--color-tertiary)]">
          {jobTitle ?? ROLE_LABELS[role]} ·{" "}
          <span style={{ color: standingTone }}>{standing}</span>
        </p>
      </div>

      {/* Your tasks — the primary surface */}
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.015em" }}>
          Your tasks
        </h2>
        {overdueCount > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-danger)]">
            {overdueCount} overdue
          </span>
        )}
      </div>

      <TaskList tasks={tasks} emptyMessage="No tasks assigned to you right now. Nice work." />

      {/* Footnote */}
      <Card className="mt-8">
        <CardBody>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-3">
            How this works
          </p>
          <ul className="space-y-2.5 text-sm text-[var(--color-secondary)] leading-relaxed">
            <Bullet>Fortify monitors your practice&apos;s compliance continuously and assigns you only what needs your attention.</Bullet>
            <Bullet>Acknowledge policies and complete tasks here — your standing updates automatically.</Bullet>
            <Bullet>Questions about a task? Reach out to your practice administrator.</Bullet>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400/70 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}
