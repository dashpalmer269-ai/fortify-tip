"use client";
import Link from "next/link";
import { Threat } from "@/lib/types";

const SEVERITY_COLOR: Record<string, { color: string; glow: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.7)" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.7)" },
  medium:   { color: "#eab308", glow: "rgba(234,179,8,0.7)"  },
  low:      { color: "#3b82f6", glow: "rgba(59,130,246,0.7)" },
};

const TAB_ACCENT: Record<string, string> = {
  registry:  "#8B5CF6",
  community: "#10B981",
  forums:    "#F97316",
};

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ThreatCard({ threat }: { threat: Threat; accentColor?: string }) {
  const sev = SEVERITY_COLOR[threat.severity ?? "low"] ?? SEVERITY_COLOR.low;
  const tabColor = TAB_ACCENT[threat.source_tab ?? "registry"] ?? "#8B5CF6";

  return (
    <Link href={`/threat/${threat.id}`}>
      <div
        className="glass-card flex items-stretch rounded-xl overflow-hidden cursor-pointer group transition-all duration-300"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = `${tabColor}55`;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 28px ${tabColor}20`;
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }}
      >
        {/* Severity accent stripe */}
        <div
          style={{
            width: "3px",
            flexShrink: 0,
            background: sev.color,
            boxShadow: `0 0 8px ${sev.glow}`,
          }}
        />

        {/* Main content */}
        <div className="flex-1 px-5 py-4 min-w-0">
          <h3 className="text-white font-bold text-[1.05rem] leading-snug mb-2 group-hover:text-violet-300 transition-colors">
            {threat.title}
          </h3>

          {threat.summary && (
            <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-3">
              {threat.summary}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${tabColor}18`, color: tabColor }}
            >
              {threat.source_name}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500">{relativeDate(threat.published_at)}</span>
            {threat.cve_id && (
              <>
                <span className="text-gray-700">·</span>
                <span className="font-mono text-violet-500/80">{threat.cve_id}</span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center pr-4 pl-2 text-gray-700 group-hover:text-violet-400 transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
