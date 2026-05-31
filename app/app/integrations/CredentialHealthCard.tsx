"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import type { CredentialScore, CredentialRiskLevel } from "@/lib/security/credential-scoring";

const LEVEL_TONE: Record<CredentialRiskLevel, "success" | "info" | "warning" | "danger" | "muted"> = {
  excellent: "success",
  high: "info",
  medium: "warning",
  low: "warning",
  critical: "danger",
};

const LEVEL_LABEL: Record<CredentialRiskLevel, string> = {
  excellent: "Excellent",
  high: "Strong",
  medium: "Adequate",
  low: "Weak",
  critical: "Critical",
};

const BAR_COLOR: Record<CredentialRiskLevel, string> = {
  excellent: "var(--color-success)",
  high: "var(--color-info)",
  medium: "var(--color-warning)",
  low: "var(--color-warning)",
  critical: "var(--color-danger)",
};

export default function CredentialHealthCard({ score }: { score: CredentialScore }) {
  const [open, setOpen] = useState(false);
  const tone = LEVEL_TONE[score.level];
  const barColor = BAR_COLOR[score.level];

  return (
    <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]">
            Credential health
          </span>
          <Badge variant={tone}>{LEVEL_LABEL[score.level]} · {score.score}/100</Badge>
        </div>
        <span className="text-[var(--color-quaternary)] text-xs">{open ? "−" : "+"}</span>
      </button>

      {/* Bar */}
      <div className="mt-2 h-1 rounded-full bg-[var(--color-surface-raised)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score.score}%`, background: barColor }}
        />
      </div>

      {open && (
        <div className="mt-3 space-y-1.5">
          {score.factors.map((f) => {
            const pct = f.max > 0 ? Math.round((f.points / f.max) * 100) : 0;
            return (
              <div key={f.axis} className="flex items-center gap-3 text-[11px]">
                <span className="w-24 shrink-0 font-mono uppercase tracking-wider text-[var(--color-quaternary)]">
                  {f.axis.replace(/_/g, " ")}
                </span>
                <div className="flex-1 h-1 rounded-full bg-[var(--color-surface-raised)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 80
                          ? "var(--color-success)"
                          : pct >= 50
                          ? "var(--color-info)"
                          : pct >= 20
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[var(--color-tertiary)] tabular-nums">
                  {f.points}/{f.max}
                </span>
                <span className="flex-[2_2_0%] text-[var(--color-tertiary)] truncate" title={f.note}>
                  {f.note}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
