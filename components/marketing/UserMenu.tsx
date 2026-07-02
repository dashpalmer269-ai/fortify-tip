"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export interface UserMenuViewer {
  email: string;
  fullName: string | null;
  accountType: "admin" | "employee";
  hasMembership: boolean;
  practiceName: string | null;
  roleLabel: string | null;
  isAdminLike: boolean;
}

/**
 * Top-right hamburger menu shown to signed-in users on marketing pages.
 * Replaces the "Login" link. Profile-aware: admin/employee, pending vs active.
 */
export default function UserMenu({ viewer }: { viewer: UserMenuViewer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials =
    (viewer.fullName?.trim() || viewer.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  const primaryHref = viewer.hasMembership
    ? "/app"
    : viewer.accountType === "employee"
    ? "/pending"
    : "/app/onboarding";
  const primaryLabel = viewer.hasMembership
    ? "Open dashboard"
    : viewer.accountType === "employee"
    ? "Check approval status"
    : "Continue onboarding";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-white/[0.08] transition-colors text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute right-0 top-12 w-72 rounded-xl border border-white/10 bg-[#0a0820]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
          style={{ boxShadow: "0 24px 60px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.10)" }}
        >
          {/* Profile header */}
          <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(99,102,241,0.45) 100%)",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-white truncate font-medium">
                {viewer.fullName || viewer.email.split("@")[0]}
              </p>
              <p className="text-[11px] text-white/55 truncate">{viewer.email}</p>
            </div>
          </div>

          {/* Practice context */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45 mb-1">
              {viewer.hasMembership ? "Workspace" : "Status"}
            </p>
            {viewer.hasMembership ? (
              <>
                <p className="text-[13px] text-white truncate">{viewer.practiceName ?? "—"}</p>
                <p className="text-[11px] text-white/55">{viewer.roleLabel ?? ""}</p>
              </>
            ) : (
              <p className="text-[13px] text-violet-200">
                {viewer.accountType === "employee" ? "Awaiting admin approval" : "Setup in progress"}
              </p>
            )}
          </div>

          {/* Actions */}
          <nav className="py-1" role="menu">
            <MenuItem href={primaryHref} primary onClick={() => setOpen(false)}>
              {primaryLabel}
            </MenuItem>

            {viewer.hasMembership && (
              <>
                <MenuItem href="/app/policies" onClick={() => setOpen(false)}>
                  Policies
                </MenuItem>
                {viewer.isAdminLike && (
                  <>
                    <MenuItem href="/app/team" onClick={() => setOpen(false)}>
                      Team
                    </MenuItem>
                    <MenuItem href="/app/billing" onClick={() => setOpen(false)}>
                      Billing
                    </MenuItem>
                  </>
                )}
                <MenuItem href="/app/settings" onClick={() => setOpen(false)}>
                  Settings
                </MenuItem>
              </>
            )}

            <div className="my-1 border-t border-white/10" />

            <MenuItem href="/" onClick={() => setOpen(false)}>
              Home
            </MenuItem>
            <MenuItem href="/pricing" onClick={() => setOpen(false)}>
              Pricing
            </MenuItem>

            <div className="my-1 border-t border-white/10" />

            <button
              onClick={signOut}
              disabled={signingOut}
              role="menuitem"
              className="w-full text-left px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  children,
  onClick,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className={`block px-4 py-2.5 text-[13px] transition-colors ${
        primary
          ? "text-violet-200 hover:bg-violet-500/10 hover:text-white font-medium"
          : "text-white/75 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
