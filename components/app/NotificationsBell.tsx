"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function refresh() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {/* ignore */}
  }

  async function openPanel() {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      setLoading(true);
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mark_all_read: true }),
        });
        setUnread(0);
        setItems((cur) => cur.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--color-surface)] transition-colors text-[var(--color-secondary)] hover:text-[var(--color-primary)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-mono font-bold text-white flex items-center justify-center"
            style={{ background: "var(--color-accent)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 surface-overlay rounded-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)]">
              Notifications
            </p>
            {loading && <span className="text-[10px] text-[var(--color-quaternary)]">marking read…</span>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--color-tertiary)] text-center">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const inner = (
                  <div className={`px-4 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface)] transition-colors ${n.read_at ? "" : "bg-violet-500/5"}`}>
                    <p className="text-[13px] text-[var(--color-primary)] font-medium mb-0.5">{n.title}</p>
                    {n.body && <p className="text-[12px] text-[var(--color-tertiary)] leading-relaxed">{n.body}</p>}
                    <p className="font-mono text-[10px] text-[var(--color-quaternary)] mt-1.5">
                      {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
