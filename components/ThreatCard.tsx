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

function readableTitle(threat: Threat): string {
  let title = threat.title ?? "";
  title = title.replace(/^CVE-\d{4}-\d{4,7}:\s*/i, "");
  title = title.replace(/^In the linux kernel,?\s+the following vulnerability has been (found|reported)[:\s]*/i, "Linux Kernel — ");
  title = title.replace(/^The (.+?) plugin for WordPress is vulnerable to (.+)/i, "WordPress Plugin: $1 — $2");
  title = title.trim();
  if (title.length > 0) title = title[0].toUpperCase() + title.slice(1);
  return title || threat.title;
}

function normalizeVuln(text: string): string {
  return text
    .replace(/\bvulnerability\b/gi, "Flaw")
    .replace(/\bvulnerabilities\b/gi, "Flaws")
    .replace(/\b(remote\s+)?code\s+execution\b/gi, "RCE")
    .replace(/\bprivilege\s+escalation\b/gi, "Privesc")
    .replace(/\bcross[- ]site\s+scripting\b/gi, "XSS")
    .replace(/\bcross[- ]site\s+request\s+forgery\b/gi, "CSRF")
    .replace(/\bsql\s+injection\b/gi, "SQL Injection")
    .replace(/\bdenial[- ]of[- ]service\b/gi, "DoS")
    .replace(/\binformation\s+disclosure\b/gi, "Data Exposure")
    .replace(/\bbuffer\s+overflow\b/gi, "Buffer Overflow")
    .replace(/\buse[- ]after[- ]free\b/gi, "Use-After-Free")
    .replace(/\bpath\s+traversal\b/gi, "Path Traversal")
    .replace(/\bimproper\s+(input\s+)?validation\b/gi, "Validation Flaw")
    .replace(/\bout[- ]of[- ]bounds\s*(read|write)?\b/gi, "OOB Memory")
    .replace(/\bnull\s+pointer\s+dereference\b/gi, "Null Ptr Crash")
    .replace(/\bserver[- ]side\s+request\s+forgery\b/gi, "SSRF")
    .replace(/\bcommand\s+injection\b/gi, "Cmd Injection")
    .replace(/\bis\s+vulnerable\s+to\b/gi, "—")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function headlineTitle(threat: Threat): string {
  // Forums articles are already written as news headlines
  if (threat.source_tab === "forums") {
    const t = threat.title ?? "";
    return t.length > 85 ? t.slice(0, 82) + "…" : t;
  }

  let title = readableTitle(threat);

  // WordPress: "WordPress Plugin: XYZ — SQL injection" → "XYZ — SQL Injection"
  const wpMatch = title.match(/^WordPress Plugin:\s*(.+?)\s*[—–]\s*(.+)/i);
  if (wpMatch) {
    return `${wpMatch[1].trim()} — ${normalizeVuln(wpMatch[2])}`;
  }

  // Linux Kernel: "Linux Kernel — use-after-free in subsystem" → "Linux Kernel Use-After-Free"
  const linuxMatch = title.match(/^Linux Kernel\s*[—–]\s*(.+)/i);
  if (linuxMatch) {
    const part = linuxMatch[1].split(/\s+in\s+/i)[0];
    return `Linux Kernel — ${normalizeVuln(part)}`;
  }

  return normalizeVuln(title);
}

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

export default function ThreatCard({ threat, accentColor }: { threat: Threat; accentColor?: string }) {
  const sev = SEVERITY_COLOR[threat.severity ?? "low"] ?? SEVERITY_COLOR.low;
  const tabColor = TAB_ACCENT[threat.source_tab ?? "registry"] ?? "#8B5CF6";
  const hoverColor = accentColor ?? `${tabColor}80`;
  const headline = headlineTitle(threat);

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
            {headline}
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
