import type { ReactNode } from "react";

type Variant = "default" | "success" | "danger" | "warning" | "info" | "accent" | "muted";

const variants: Record<Variant, string> = {
  default: "text-[var(--color-secondary)] bg-[var(--color-surface)] border-[var(--color-border-default)]",
  muted:   "text-[var(--color-tertiary)] bg-transparent border-[var(--color-border-subtle)]",
  success: "text-[var(--color-success)] bg-[var(--color-success-soft)] border-[var(--color-success)]/30",
  danger:  "text-[var(--color-danger)] bg-[var(--color-danger-soft)] border-[var(--color-danger)]/30",
  warning: "text-[var(--color-warning)] bg-[var(--color-warning-soft)] border-[var(--color-warning)]/30",
  info:    "text-[var(--color-info)] bg-[var(--color-info-soft)] border-[var(--color-info)]/30",
  accent:  "text-[var(--color-accent)] bg-[var(--color-accent-soft)] border-[var(--color-accent)]/30",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
