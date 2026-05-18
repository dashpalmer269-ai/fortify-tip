"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * Public marketing top-nav. Used on /, /pricing, /intel.
 * Mobile-first: hamburger opens a full-screen overlay on small viewports.
 */
export default function MarketingNav({ active }: { active?: "features" | "intel" | "about" }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navLink = (href: string, label: string, key: typeof active) =>
    href.startsWith("#") || href.startsWith("/") ? (
      <Link
        key={label}
        href={href}
        onClick={() => setOpen(false)}
        className={`transition-colors ${
          active === key ? "text-white" : "text-white/65 hover:text-white"
        }`}
      >
        {label}
      </Link>
    ) : null;

  return (
    <>
      <header className="relative z-30 mx-auto max-w-7xl px-6 sm:px-8 py-6 sm:py-7 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Fortify home">
          <span className="relative w-[18px] h-[18px] flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-violet-500/30 blur-md" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-violet-300" />
          </span>
          <span className="font-mono text-[12px] font-semibold tracking-[0.45em] text-white uppercase">
            Fortify
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10 text-[13px] font-sans">
          {navLink("/#features", "Features", "features")}
          {navLink("/intel", "Intel", "intel")}
          {navLink("/#about", "About", "about")}
        </nav>

        {/* Desktop login + mobile hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden md:block text-[13px] text-white/80 hover:text-white transition-colors font-sans"
          >
            Login
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile overlay menu */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-[#04031a]/96 backdrop-blur-md flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="px-6 py-6 flex items-center justify-between">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
              <span className="relative w-[18px] h-[18px] flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-violet-500/30 blur-md" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-violet-300" />
              </span>
              <span className="font-mono text-[12px] font-semibold tracking-[0.45em] text-white uppercase">
                Fortify
              </span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="w-10 h-10 -mr-2 flex items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors"
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 flex flex-col justify-center px-8 gap-7 text-3xl font-sans">
            <Link href="/#features" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">Features</Link>
            <Link href="/intel" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">Intel</Link>
            <Link href="/#about" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">About</Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">Pricing</Link>
            <div className="border-t border-white/10 my-2" />
            <Link href="/login" onClick={() => setOpen(false)} className="text-white/65 hover:text-white text-2xl">Login</Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="text-violet-300 hover:text-violet-200 text-2xl"
            >
              Begin trial →
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
