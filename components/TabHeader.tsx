"use client";
import Link from "next/link";

export default function TabHeader({
  title,
  accentBg,
}: {
  title: string;
  accentBg?: string;
}) {
  return (
    <div className="border-b border-[var(--color-border-subtle)]" style={accentBg ? { background: accentBg } : undefined}>
      <div className="max-w-5xl mx-auto px-8 pt-10 pb-8">
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/app/threats"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Threat intel
          </Link>
          <Link
            href="/app/threats/search?q="
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Search →
          </Link>
        </div>
        <h1 className="font-display text-4xl text-[var(--color-primary)] leading-none" style={{ letterSpacing: "-0.025em" }}>
          {title}
        </h1>
      </div>
    </div>
  );
}
