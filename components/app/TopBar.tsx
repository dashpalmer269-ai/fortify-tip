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
    <header className="h-14 shrink-0 border-b border-white/[0.06] bg-black/40 backdrop-blur-md flex items-center justify-between px-6">
      <div className="text-xs text-gray-600 tracking-[0.3em] uppercase">
        Fortify · <span className="text-gray-500">Compliance Workspace</span>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          <div
            className="w-7 h-7 rounded-full bg-violet-500/30 border border-violet-400/40 flex items-center justify-center text-xs font-semibold text-white"
            style={{ boxShadow: "0 0 10px rgba(139,92,246,0.45)" }}
          >
            {initial}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs text-white truncate max-w-[180px]">{userEmail}</p>
            <p className="text-[10px] text-gray-500 capitalize">{role.replace("_", " ")}</p>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl py-2 z-50">
            <Link
              href="/app/settings"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Account settings
            </Link>
            <Link
              href="/app/team"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Manage team
            </Link>
            <div className="border-t border-white/[0.06] my-1" />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white"
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
