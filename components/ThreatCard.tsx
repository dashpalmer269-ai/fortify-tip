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

const FIX_BADGE: Record<string, { label: string; color: string }> = {
  patched:    { label: "Patched",    color: "rgba(16,185,129,0.2)"  },
  workaround: { label: "Workaround", color: "rgba(234,179,8,0.2)"   },
  fixing:     { label: "Fixing",     color: "rgba(239,68,68,0.2)"   },
};

function CredibilityDot({ score }: { score: number | null }) {
  if (!score) return null;
  const color = score >= 8 ? "#10b981" : score >= 5 ? "#eab308" : "#ef4444";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color }}
      title={`Credibility: ${score}/10`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {score}/10
    </span>
  );
}

export default function ThreatCard({
  threat,
  accentColor,
}: {
  threat: Threat;
  accentColor?: string;
}) {
  const sev = SEVERITY_STYLES[threat.severity ?? "low"];
  const fix = FIX_BADGE[threat.fix_status ?? "fixing"];
  const tabAccent = accentColor ?? TAB_ACCENT[threat.source_tab ?? "registry"];

  return (
    <Link href={`/threat/${threat.id}`}>
      <div
        className="glass-card rounded-xl p-5 cursor-pointer transition-all duration-300 group"
        style={{ "--hover-glow": tabAccent } as React.CSSProperties}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = tabAccent;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${tabAccent}, 0 0 40px ${tabAccent.replace("0.4","0.1")}`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }}
      >
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

        <h3 className="text-white font-semibold text-base leading-snug mb-2 line-clamp-2 group-hover:text-violet-300 transition-colors">
          {threat.title}
        </h3>

        {threat.summary && (
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-4">
            {threat.summary}
          </p>
        )}

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

          {fix && (
            <>
              <span>·</span>
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: fix.color, color: "#fff" }}
              >
                {fix.label}
              </span>
            </>
          )}

          <span className="ml-auto">
            <CredibilityDot score={threat.credibility_score} />
          </span>
        </div>

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
