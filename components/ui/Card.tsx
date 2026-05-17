import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "raised" | "interactive";
  as?: "div" | "article" | "section";
}

/**
 * Surface primitive. Variants:
 *  - default: subtle background, subtle border (most content)
 *  - raised: slightly stronger background (modal-ish, callouts)
 *  - interactive: hover-state aware (when wrapping a Link)
 */
export function Card({ children, className = "", variant = "default", as: As = "div" }: CardProps) {
  const base =
    variant === "raised"
      ? "surface-raised"
      : variant === "interactive"
      ? "surface transition-all duration-150 hover:bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)] group/card"
      : "surface";
  return <As className={`${base} rounded-xl ${className}`}>{children}</As>;
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 pt-5 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-6 pb-5 pt-3 border-t border-[var(--color-border-subtle)] ${className}`}>
      {children}
    </div>
  );
}
