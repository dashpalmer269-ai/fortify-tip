"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface MappedControl {
  controlId: string;
  controlKey: string;
  controlTitle: string;
  controlWeight: number;
  audience: string;
  mappingStrength: string | null;
  mappingConfidence: "high" | "medium" | "low";
  basis: string | null;
  status: string;
}

export interface RequirementRow {
  id: string;
  framework: string;
  framework_name: string;
  citation: string;
  parent_citation: string | null;
  title: string;
  description: string;
  category: string | null;
  obligation_type: "required" | "addressable" | "recommended" | null;
  weight: number | null;
  source_url: string | null;
  source_type: string | null;
  coverage_status: "covered" | "partial" | "uncovered" | "unmapped";
  mapped_controls: MappedControl[];
}

type Tone = "default" | "muted" | "success" | "danger" | "warning" | "info" | "accent";

const COVERAGE_META: Record<RequirementRow["coverage_status"], { label: string; tone: Tone }> = {
  covered:   { label: "Covered",          tone: "success" },
  partial:   { label: "Partial coverage", tone: "warning" },
  uncovered: { label: "Not covered",      tone: "danger"  },
  unmapped:  { label: "No control mapped", tone: "muted"  },
};

const FRAMEWORK_TONE: Record<string, string> = {
  HIPAA:    "var(--color-fw-hipaa)",
  SOC2:     "var(--color-fw-soc2)",
  ISO27001: "var(--color-fw-iso)",
  GDPR:     "var(--color-fw-gdpr)",
};

const OBLIGATION_LABEL: Record<string, string> = {
  required:    "Required",
  addressable: "Addressable",
  recommended: "Recommended",
};

const CONTROL_STATUS_TONE: Record<string, Tone> = {
  compliant:      "success",
  partial:        "warning",
  non_compliant:  "danger",
  not_started:    "muted",
  not_applicable: "muted",
};

export default function CoverageBrowser({
  requirements,
  initialFramework,
  initialCategory,
  initialStatus,
}: {
  requirements: RequirementRow[];
  initialFramework: string | null;
  initialCategory: string | null;
  initialStatus: string | null;
}) {
  const [framework, setFramework] = useState<string | null>(initialFramework);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allFrameworks = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.framework))).sort(),
    [requirements]
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set(requirements.filter((r) => !framework || r.framework === framework).map((r) => r.category).filter(Boolean))
      ).sort() as string[],
    [requirements, framework]
  );

  const filtered = requirements.filter((r) => {
    if (framework && r.framework !== framework) return false;
    if (category && r.category !== category) return false;
    if (status && r.coverage_status !== status) return false;
    return true;
  });

  // Per-framework summary stats (for the strip at the top)
  const summary = useMemo(() => {
    const m = new Map<string, { covered: number; partial: number; uncovered: number; unmapped: number; total: number }>();
    for (const r of requirements) {
      const cur = m.get(r.framework) ?? { covered: 0, partial: 0, uncovered: 0, unmapped: 0, total: 0 };
      cur.total++;
      cur[r.coverage_status]++;
      m.set(r.framework, cur);
    }
    return m;
  }, [requirements]);

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Source-backed audit prep"
        title="Framework coverage"
        description="The inverse view of /app/compliance. Every framework citation in the library, with its coverage status and the control(s) that satisfy it — answers 'which regulations am I actually covered against?'"
      />

      {/* Per-framework summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        {allFrameworks.map((fw) => {
          const s = summary.get(fw);
          if (!s) return null;
          const coveragePct = s.total > 0 ? Math.round((s.covered / s.total) * 100) : 0;
          return (
            <button
              key={fw}
              onClick={() => setFramework(framework === fw ? null : fw)}
              className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                framework === fw
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]"
                  : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span
                  className="font-mono text-[11px] uppercase tracking-wider"
                  style={{ color: FRAMEWORK_TONE[fw] ?? "var(--color-accent)" }}
                >
                  {fw}
                </span>
                <span className="text-[var(--color-primary)] text-lg font-medium tabular-nums">{coveragePct}%</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--color-surface)] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${coveragePct}%`,
                    background: FRAMEWORK_TONE[fw] ?? "var(--color-accent)",
                  }}
                />
              </div>
              <p className="font-mono text-[10px] text-[var(--color-tertiary)]">
                <span className="text-[var(--color-success)]">{s.covered}</span>
                {" "}covered · {" "}
                <span className="text-[var(--color-warning)]">{s.partial}</span>
                {" "}partial · {" "}
                <span className="text-[var(--color-danger)]">{s.uncovered}</span>
                {" "}gaps · {" "}
                <span className="text-[var(--color-quaternary)]">{s.unmapped}</span>
                {" "}unmapped
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter strip */}
      <Card className="px-4 py-3 mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-quaternary)] mr-2">Filter</span>
        <select
          value={framework ?? ""}
          onChange={(e) => setFramework(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">All frameworks</option>
          {allFrameworks.map((fw) => (
            <option key={fw} value={fw} className="bg-black">{fw}</option>
          ))}
        </select>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-black capitalize">{c.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">Any coverage</option>
          {Object.entries(COVERAGE_META).map(([k, m]) => (
            <option key={k} value={k} className="bg-black">{m.label}</option>
          ))}
        </select>
        <span className="font-mono text-[10px] text-[var(--color-quaternary)] ml-auto">
          {filtered.length} of {requirements.length} citations
        </span>
      </Card>

      {/* Requirements list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <Card className="py-16 text-center text-sm text-[var(--color-tertiary)]">
            No requirements match the current filters.
          </Card>
        )}
        {filtered.map((r) => {
          const meta = COVERAGE_META[r.coverage_status];
          const isExpanded = expandedId === r.id;
          return (
            <Card key={r.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-raised)] transition-colors text-left"
              >
                <span
                  className="font-mono text-[10px] uppercase tracking-wider shrink-0 w-16"
                  style={{ color: FRAMEWORK_TONE[r.framework] ?? "var(--color-accent)" }}
                >
                  {r.framework}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {r.source_url ? (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[11px] text-[var(--color-accent)] hover:text-[var(--color-primary)]"
                      >
                        {r.citation}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--color-primary)]">{r.citation}</span>
                    )}
                    <span className="text-[var(--color-secondary)] text-[13px]">{r.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--color-tertiary)] uppercase tracking-wider">
                    {r.category && <><span>{r.category.replace(/_/g, " ")}</span><span>·</span></>}
                    {r.obligation_type && <><span>{OBLIGATION_LABEL[r.obligation_type] ?? r.obligation_type}</span><span>·</span></>}
                    <span>{r.mapped_controls.length} mapped {r.mapped_controls.length === 1 ? "control" : "controls"}</span>
                  </div>
                </div>
                <Badge variant={meta.tone}>{meta.label}</Badge>
                <span className="text-[var(--color-quaternary)] text-xs shrink-0 ml-1">
                  {isExpanded ? "−" : "+"}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--color-border-subtle)] px-5 py-4 bg-[var(--color-surface)] space-y-3">
                  <p className="text-sm text-[var(--color-secondary)] leading-relaxed">{r.description}</p>
                  {r.mapped_controls.length === 0 ? (
                    <div className="font-mono text-[11px] text-[var(--color-quaternary)] italic">
                      No Fortify control is currently mapped to this requirement. Coverage gap.
                    </div>
                  ) : (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-2">
                        Mapped controls
                      </div>
                      <div className="space-y-1.5">
                        {r.mapped_controls.map((c) => {
                          const statusTone = CONTROL_STATUS_TONE[c.status] ?? "muted";
                          return (
                            <div key={c.controlId} className="flex items-start gap-3 text-[12px] leading-relaxed">
                              <span className="font-mono text-[10px] text-[var(--color-tertiary)] shrink-0 w-16 mt-0.5">{c.controlKey}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[var(--color-primary)]">{c.controlTitle}</span>
                                  <Badge variant={statusTone}>{c.status.replace(/_/g, " ")}</Badge>
                                  {c.audience === "fortify_internal" && <Badge variant="info">Fortify-managed</Badge>}
                                  <Badge variant={c.mappingConfidence === "high" ? "success" : c.mappingConfidence === "medium" ? "info" : "warning"}>
                                    {c.mappingConfidence} confidence
                                  </Badge>
                                </div>
                                {c.basis && (
                                  <p className="text-[11px] text-[var(--color-quaternary)] italic mt-0.5">{c.basis}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {r.source_url && (
                    <p className="font-mono text-[10px] text-[var(--color-quaternary)]">
                      Source:{" "}
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:text-[var(--color-primary)]">
                        {r.source_url}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
