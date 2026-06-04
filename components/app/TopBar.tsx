"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import NotificationsBell from "./NotificationsBell";

interface Props {
  userEmail: string;
  role: string;
}

export default function TopBar({ userEmail, role }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initial = (userEmail[0] ?? "?").toUpperCase();

  return (
    <header className="h-14 shrink-0 border-b border-[var(--color-border-subtle)] flex items-center justify-between px-8 bg-[var(--color-canvas)]">
      <div className="flex items-center gap-4">
        <Link
          href="/app"
          className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-quaternary)] hover:text-[var(--color-primary)] transition-colors"
        >
          Workspace
        </Link>
        <span
          title="Fortify never creates, receives, maintains, transmits, or stores PHI (45 CFR §160.103). Architectural rule, not a setting."
          className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 font-mono text-[9px] uppercase tracking-[0.25em]"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          PHI-free
        </span>
      </div>

      <div className="flex items-center gap-1">
        <NotificationsBell />
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((s) => !s)}
          aria-label="Account menu"
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-canvas)] transition-colors"
        >
          <div className="w-7 h-7 rounded-full surface-raised flex items-center justify-center text-[12px] font-medium text-[var(--color-primary)]">
            {initial}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[12px] text-[var(--color-primary)] truncate max-w-[180px] leading-tight">{userEmail}</p>
            <p className="text-[10px] text-[var(--color-quaternary)] capitalize font-mono tracking-wider mt-0.5">
              {role.replace("_", " ")}
            </p>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 surface-overlay rounded-lg py-1.5 z-50 animate-fade-in-fast">
            <Link
              href="/app/settings"
              className="block px-4 py-2 text-[13px] text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              onClick={() => setOpen(false)}
            >
              Account settings
            </Link>
            <Link
              href="/app/team"
              className="block px-4 py-2 text-[13px] text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              onClick={() => setOpen(false)}
            >
              Manage team
            </Link>
            <Link
              href="/app/billing"
              className="block px-4 py-2 text-[13px] text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              onClick={() => setOpen(false)}
            >
              Billing
            </Link>
            <div className="border-t border-[var(--color-border-subtle)] my-1" />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-[13px] text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
