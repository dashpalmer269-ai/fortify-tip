"use client";
import Link from "next/link";

export default function TabHeader({
  title,
  accentBg,
}: {
  title: string;
  accentBg: string;
}) {
  return (
    <div className="border-b border-white/[0.06]" style={{ background: accentBg }}>
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-8">
        {/* Icon pair — Home on the left, Search on the right */}
        <div className="flex items-center justify-between mb-12">
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

        {/* Section title */}
        <h1 className="text-6xl font-black tracking-tight text-white leading-none">{title}</h1>
      </div>
    </div>
  );
}
