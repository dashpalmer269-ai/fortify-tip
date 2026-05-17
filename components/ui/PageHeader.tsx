import type { ReactNode } from "react";

/**
 * Standard page header used at the top of every /app/* screen.
 * Editorial: eyebrow (mono), serif display title, supporting body, optional right action.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 animate-fade-in">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-3">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[var(--text-display-3)] sm:text-4xl text-[var(--color-primary)] leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-[var(--color-secondary)] text-[15px] leading-relaxed mt-3">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
