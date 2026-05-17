"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  compliant:    { label: "Compliant",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  partial:      { label: "Partial",      color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  non_compliant:{ label: "Non-compliant",color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  not_started:  { label: "Not started",  color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  not_applicable:{label: "N/A",          color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const PRIORITY_META: Record<string, { dot: string }> = {
  critical: { dot: "#ef4444" },
  high:     { dot: "#f97316" },
  medium:   { dot: "#eab308" },
  low:      { dot: "#3b82f6" },
};

const FRAMEWORK_COLOR: Record<string, string> = {
  HIPAA: "#8b5cf6",
  SOC2: "#3b82f6",
  ISO27001: "#10b981",
  GDPR: "#f97316",
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

  async function markCompliant(control: ControlRow) {
    setSavingId(control.id);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from("practice_controls").upsert(
        {
          practice_id: practiceId,
          control_id: control.id,
          status: "compliant",
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "practice_id,control_id" }
      );
      if (error) throw new Error(error.message);
      // Log the action so it shows up on the dashboard activity feed
      await supabase.from("audit_logs").insert({
        practice_id: practiceId,
        action: "control.marked_compliant",
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

  async function markNonCompliant(control: ControlRow) {
    setSavingId(control.id);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from("practice_controls").upsert(
        {
          practice_id: practiceId,
          control_id: control.id,
          status: "non_compliant",
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "practice_id,control_id" }
      );
      if (error) throw new Error(error.message);
      await supabase.from("audit_logs").insert({
        practice_id: practiceId,
        action: "control.marked_non_compliant",
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
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Controls library</p>
        <h1 className="text-3xl font-bold text-white">Compliance</h1>
        <p className="text-sm text-gray-500 mt-2">
          One control row, many framework requirements. Marking compliant updates HIPAA, SOC 2, ISO 27001, and GDPR scores simultaneously.
        </p>
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
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
            color={FRAMEWORK_COLOR[fw]}
            onClick={() => setFramework(framework === fw ? null : fw)}
          />
        ))}
        <div className="w-px h-6 bg-white/10 mx-1" />
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="" className="bg-black">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-black">
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || null)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="" className="bg-black">Any status</option>
          {Object.entries(STATUS_META).map(([key, m]) => (
            <option key={key} value={key} className="bg-black">{m.label}</option>
          ))}
        </select>
      </div>

      {/* Counts strip */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4 px-1">
        <span><strong className="text-white">{counts.total}</strong> showing</span>
        <span>· <strong className="text-emerald-400">{counts.compliant}</strong> compliant</span>
        <span>· <strong className="text-yellow-400">{counts.partial}</strong> partial</span>
        <span>· <strong className="text-red-400">{counts.non_compliant}</strong> non-compliant</span>
        <span>· <strong className="text-gray-300">{counts.not_started}</strong> not started</span>
      </div>

      {/* Control list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
            No controls match the current filters.
          </div>
        )}
        {filtered.map((c) => {
          const statusMeta = STATUS_META[c.status] ?? STATUS_META.not_started;
          const priority = c.default_priority ?? "medium";
          const priorityMeta = PRIORITY_META[priority] ?? PRIORITY_META.medium;
          const isExpanded = expandedId === c.id;
          const isSaving = savingId === c.id;
          return (
            <div
              key={c.id}
              className="glass-card rounded-xl overflow-hidden transition-all"
              style={{ boxShadow: isExpanded ? `0 0 24px ${statusMeta.color}25` : undefined }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div
                  className="w-2 h-10 rounded-full shrink-0"
                  style={{
                    background: priorityMeta.dot,
                    boxShadow: `0 0 8px ${priorityMeta.dot}80`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{c.title}</h3>
                    {c.healthcare_baseline && (
                      <span className="text-[10px] uppercase tracking-wider text-violet-300 px-1.5 py-0.5 rounded bg-violet-500/15">
                        baseline
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{c.mapping_count} requirements</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      {c.frameworks.map((fw) => (
                        <span
                          key={fw}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            color: FRAMEWORK_COLOR[fw] ?? "#a78bfa",
                            background: `${FRAMEWORK_COLOR[fw] ?? "#a78bfa"}18`,
                          }}
                        >
                          {fw}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                  style={{ color: statusMeta.color, background: statusMeta.bg }}
                >
                  {statusMeta.label}
                </span>
                <span className="text-gray-600 text-xs shrink-0">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-white/[0.05] px-5 py-4 bg-black/30">
                  <p className="text-sm text-gray-300 leading-relaxed mb-4">{c.description}</p>
                  {c.last_verified_at && (
                    <p className="text-xs text-gray-500 mb-4">
                      Last verified:{" "}
                      {new Date(c.last_verified_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={isSaving}
                      onClick={() => markCompliant(c)}
                      className="text-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
                    >
                      {isSaving ? "Saving…" : "✓ Mark compliant"}
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={() => markNonCompliant(c)}
                      className="text-sm bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
                    >
                      ✕ Mark non-compliant
                    </button>
                    <button
                      disabled
                      title="Evidence upload — Phase E"
                      className="text-sm bg-violet-500/10 text-violet-300/60 border border-violet-500/20 rounded-lg px-4 py-2 cursor-not-allowed"
                    >
                      ⬆ Upload evidence
                    </button>
                  </div>
                </div>
              )}
            </div>
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
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition-all ${
        active
          ? "text-white"
          : "text-gray-400 hover:text-white border border-white/10 hover:border-white/20"
      }`}
      style={
        active
          ? {
              background: color ? `${color}25` : "rgba(139,92,246,0.25)",
              border: `1px solid ${color ? `${color}80` : "rgba(139,92,246,0.5)"}`,
              boxShadow: `0 0 12px ${color ? `${color}40` : "rgba(139,92,246,0.35)"}`,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}
