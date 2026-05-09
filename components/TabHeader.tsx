"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function TabHeader({
  title,
  accentBg,
}: {
  title: string;
  accentBg: string;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    if (spinning) return;
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 750);
  }

  return (
    <div className="border-b border-white/[0.06]" style={{ background: accentBg }}>
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-8">
        {/* Icon trio — evenly spaced across full width */}
        <div className="grid grid-cols-3 items-center mb-12">
          {/* Home — left */}
          <div className="flex justify-start">
            <Link
              href="/"
              className="p-3 rounded-2xl glass-card transition-all duration-300"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(139,92,246,0.65)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
          </div>

          {/* Refresh — center */}
          <div className="flex justify-center">
            <button
              onClick={handleRefresh}
              className="p-3 rounded-2xl glass-card transition-all duration-300"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(6,182,212,0.65)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: spinning ? "spin 0.75s linear 1" : "none" }}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>

          {/* Search — right */}
          <div className="flex justify-end">
            <Link
              href="/search"
              className="p-3 rounded-2xl glass-card transition-all duration-300"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(139,92,246,0.65)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Section title */}
        <h1 className="text-6xl font-black tracking-tight text-white leading-none">{title}</h1>
      </div>
    </div>
  );
}
