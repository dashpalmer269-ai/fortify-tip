"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ControlRow {
  id: string;
  control_key: string;
  title: string;
  description: string;
  category: string;
  implementation_type: string | null;
  default_priority: string | null;
  healthcare_baseline: boolean | null;
  frameworks: string[];
  mapping_count: number;
  status: string;
  last_verified_at: string | null;
  implementation_notes: string | null;
}

type Variant = "default" | "muted" | "success" | "danger" | "warning" | "info" | "accent";

const STATUS_META = {
  compliant:      { label: "Compliant",     variant: "success" as Variant },
  partial:        { label: "Partial",       variant: "warning" as Variant },
  non_compliant:  { label: "Non-compliant", variant: "danger" as Variant },
  not_started:    { label: "Not started",   variant: "muted" as Variant },
  not_applicable: { label: "N/A",           variant: "muted" as Variant },
} as const;

const PRIORITY_DOT: Record<string, string> = {
  critical: "var(--color-danger)",
  high:     "var(--color-warning)",
  medium:   "var(--color-info)",
  low:      "var(--color-tertiary)",
};

const FRAMEWORK_TONE: Record<string, string> = {
  HIPAA:    "var(--color-fw-hipaa)",
  SOC2:     "var(--color-fw-soc2)",
  ISO27001: "var(--color-fw-iso)",
  GDPR:     "var(--color-fw-gdpr)",
};

export default function ComplianceBrowser({
  practiceId,
  controls,
  initialFramework,
  initialCategory,
  initialStatus,
}: {
  practiceId: string;
  controls: ControlRow[];
  initialFramework: string | null;
  initialCategory: string | null;
  initialStatus: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [framework, setFramework] = useState<string | null>(initialFramework);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(controls.map((c) => c.category))).sort(),
    [controls]
  );
  const allFrameworks = ["HIPAA", "SOC2", "ISO27001", "GDPR"];

  const filtered = controls.filter((c) => {
    if (framework && !c.frameworks.includes(framework)) return false;
    if (category && c.category !== category) return false;
    if (status && c.status !== status) return false;
    return true;
  });

  const counts = {
    total: filtered.length,
    compliant: filtered.filter((c) => c.status === "compliant").length,
    partial: filtered.filter((c) => c.status === "partial").length,
    non_compliant: filtered.filter((c) => c.status === "non_compliant").length,
    not_started: filtered.filter((c) => c.status === "not_started").length,
  };

  async function setStatusOnControl(control: ControlRow, newStatus: "compliant" | "non_compliant") {
    setSavingId(control.id);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from("practice_controls").upsert(
        {
          practice_id: practiceId,
          control_id: control.id,
          status: newStatus,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "practice_id,control_id" }
      );
      if (error) throw new Error(error.message);
      await supabase.from("audit_logs").insert({
        practice_id: practiceId,
        action: newStatus === "compliant" ? "control.marked_compliant" : "control.marked_non_compliant",
        resource_type: "practice_control",
        resource_id: control.id,
        metadata: { control_key: control.control_key, control_title: control.title },
      });
      startTransition(() => router.refresh());
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Controls library"
        title="Compliance"
        description="One control, many requirements. Marking compliant updates every framework score the control is mapped to."
      />

      {/* Filters */}
      <Card className="px-4 py-3 mb-6 flex flex-wrap items-center gap-2">
        <FilterChip
          label="All frameworks"
          active={!framework}
          onClick={() => setFramework(null)}
        />
        {allFrameworks.map((fw) => (
          <FilterChip
            key={fw}
            label={fw}
            active={framework === fw}
            tone={FRAMEWORK_TONE[fw]}
            onClick={() => setFramework(framework === fw ? null : fw)}
          />
        ))}
        <span className="w-px h-5 bg-[var(--color-border-default)] mx-1" />
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-black capitalize">
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">Any status</option>
          {Object.entries(STATUS_META).map(([key, m]) => (
            <option key={key} value={key} className="bg-black">{m.label}</option>
          ))}
        </select>
      </Card>

      {/* Counts strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-[var(--color-tertiary)] mb-5 px-1">
        <span className="text-[var(--color-secondary)]"><strong className="text-[var(--color-primary)]">{counts.total}</strong> showing</span>
        <span><strong className="text-[var(--color-success)]">{counts.compliant}</strong> compliant</span>
        <span><strong className="text-[var(--color-warning)]">{counts.partial}</strong> partial</span>
        <span><strong className="text-[var(--color-danger)]">{counts.non_compliant}</strong> non-compliant</span>
        <span><strong className="text-[var(--color-tertiary)]">{counts.not_started}</strong> not started</span>
      </div>

      {/* Control list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <Card className="py-16 text-center text-sm text-[var(--color-tertiary)]">
            No controls match the current filters.
          </Card>
        )}
        {filtered.map((c) => {
          const statusMeta = STATUS_META[c.status as keyof typeof STATUS_META] ?? STATUS_META.not_started;
          const priority = c.default_priority ?? "medium";
          const isExpanded = expandedId === c.id;
          const isSaving = savingId === c.id;
          return (
            <Card key={c.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-raised)] transition-colors text-left"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: PRIORITY_DOT[priority] }}
                  aria-label={`Priority: ${priority}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[var(--color-primary)] text-[14px] font-medium leading-tight">{c.title}</h3>
                    {c.healthcare_baseline && <Badge variant="accent">baseline</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--color-tertiary)] uppercase tracking-wider">
                    <span>{c.category.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{c.mapping_count} requirements</span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5 normal-case tracking-normal">
                      {c.frameworks.map((fw) => (
                        <span
                          key={fw}
                          className="font-mono text-[9px] uppercase tracking-wider"
                          style={{ color: FRAMEWORK_TONE[fw] ?? "var(--color-accent)" }}
                        >
                          {fw}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                <span className="text-[var(--color-quaternary)] text-xs shrink-0 ml-1">
                  {isExpanded ? "−" : "+"}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--color-border-subtle)] px-5 py-4 bg-[var(--color-surface)]">
                  <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-4">{c.description}</p>
                  {c.last_verified_at && (
                    <p className="font-mono text-[11px] text-[var(--color-quaternary)] mb-4">
                      Last verified{" "}
                      {new Date(c.last_verified_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={isSaving}
                      onClick={() => setStatusOnControl(c, "compliant")}
                    >
                      Mark compliant
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => setStatusOnControl(c, "non_compliant")}
                    >
                      Non-compliant
                    </Button>
                    <Button variant="ghost" size="sm" disabled title="Evidence upload — planned">
                      Upload evidence
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-md font-mono uppercase tracking-wider transition-all border ${
        active
          ? "text-[var(--color-primary)] border-[var(--color-border-strong)]"
          : "text-[var(--color-tertiary)] border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-border-default)]"
      }`}
      style={active && tone ? { color: tone, borderColor: `${tone}55` } : undefined}
    >
      {label}
    </button>
  );
}
