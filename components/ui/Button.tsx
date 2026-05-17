import Link from "next/link";
import type { ReactNode, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[#7c4ef0] active:bg-[#6d44d8] shadow-[0_0_24px_rgba(139,92,246,0.45)]",
  secondary:
    "border border-[var(--color-border-default)] text-[var(--color-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]",
  ghost:
    "text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]",
  danger:
    "border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-[15px] rounded-lg",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps & Omit<ComponentProps<"button">, "children" | "className">;
type LinkButtonProps = BaseProps &
  Omit<ComponentProps<typeof Link>, "children" | "className"> & { href: string };

const base =
  "inline-flex items-center justify-center gap-2 font-medium leading-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  children,
  className = "",
  href,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      {...rest}
      href={href}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
