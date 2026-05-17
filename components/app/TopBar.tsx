"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

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
      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-quaternary)]">
        Fortify ·  <span className="text-[var(--color-tertiary)]">Workspace</span>
      </p>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-[var(--color-surface)] transition-colors"
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
    </header>
  );
}
