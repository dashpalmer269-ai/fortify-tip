"use client";
import Link from "next/link";
import { Threat } from "@/lib/types";

const SEVERITY_STYLES: Record<string, { color: string; glow: string; bg: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.12)" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.5)", bg: "rgba(249,115,22,0.12)" },
  medium:   { color: "#eab308", glow: "rgba(234,179,8,0.5)",  bg: "rgba(234,179,8,0.12)" },
  low:      { color: "#3b82f6", glow: "rgba(59,130,246,0.5)", bg: "rgba(59,130,246,0.12)" },
};

const TAB_ACCENT: Record<string, string> = {
  registry:  "rgba(139,92,246,0.4)",
  community: "rgba(16,185,129,0.4)",
  forums:    "rgba(249,115,22,0.4)",
};

function readableTitle(threat: Threat): string {
  let title = threat.title ?? "";
  // Strip leading "CVE-XXXX-XXXXX: " prefix — the CVE ID badge already shows it
  title = title.replace(/^CVE-\d{4}-\d{4,7}:\s*/i, "");
  // Strip "In the Linux kernel, the following vulnerability has been found:" boilerplate
  title = title.replace(/^In the linux kernel,?\s+the following vulnerability has been (found|reported)[:\s]*/i, "Linux Kernel — ");
  // Strip "The X plugin for WordPress is vulnerable to" → "WordPress Plugin: X vulnerable to"
  title = title.replace(/^The (.+?) plugin for WordPress is vulnerable to (.+)/i, "WordPress Plugin: $1 — $2");
  // Trim and capitalise
  title = title.trim();
  if (title.length > 0) title = title[0].toUpperCase() + title.slice(1);
  return title || threat.title;
}

export default function ThreatCard({ threat, accentColor }: { threat: Threat; accentColor?: string }) {
  const sev = SEVERITY_STYLES[threat.severity ?? "low"] ?? SEVERITY_STYLES.low;
  const tabAccent = accentColor ?? TAB_ACCENT[threat.source_tab ?? "registry"];
  const title = readableTitle(threat);

  return (
    <Link href={`/threat/${threat.id}`}>
      <div
        className="glass-card rounded-xl p-5 cursor-pointer transition-all duration-300 group"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = tabAccent;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${tabAccent}, 0 0 40px ${tabAccent.replace("0.4","0.1")}`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }}
      >
        {/* Top row: severity + critical flag */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
            style={{ color: sev.color, background: sev.bg, boxShadow: `0 0 10px ${sev.glow}` }}
          >
            {threat.severity ?? "low"}
          </span>
          {threat.is_critical && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)", boxShadow: "0 0 10px rgba(239,68,68,0.4)" }}
            >
              ⚡ Critical
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-base leading-snug mb-2 line-clamp-2 group-hover:text-violet-300 transition-colors">
          {title}
        </h3>

        {/* Summary */}
        {threat.summary && (
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-4">
            {threat.summary}
          </p>
        )}

        {/* Footer: CVE · source · date */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {threat.cve_id && (
            <span className="font-mono text-violet-400">{threat.cve_id}</span>
          )}
          {threat.cve_id && <span>·</span>}
          <span>{threat.source_name}</span>
          <span>·</span>
          <span>
            {threat.published_at
              ? new Date(threat.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Unknown date"}
          </span>
        </div>

        {/* Tags */}
        {threat.tags && threat.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {threat.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: "rgba(139,92,246,0.12)", color: "rgba(167,139,250,0.9)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
