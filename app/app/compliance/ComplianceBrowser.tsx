"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
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
  healthcare_category: string | null;
  audience: string | null;
  automation_status: string | null;
  evidence_summary: string | null;
  remediation_guide: string | null;
  report_output_text: string | null;
  frameworks: string[];
  mapping_count: number;
  status: string;
  last_verified_at: string | null;
  implementation_notes: string | null;
  primary_evidence_check_id: string | null;
  latest_evidence_at: string | null;
  latest_evidence_status: string | null;
  latest_evidence_file: string | null;
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

const HEALTHCARE_CATEGORY_LABELS: Record<string, string> = {
  employee_access:           "Employee Access",
  mfa_identity:              "MFA & Identity",
  hipaa_training:            "HIPAA Training",
  policy_acknowledgments:    "Policy Acknowledgments",
  vendor_baa_management:     "Vendor / BAA Management",
  backup_disaster_recovery:  "Backup & Disaster Recovery",
  audit_logs:                "Audit Logs",
  device_security:           "Device Security",
  exclusion_screening:       "Exclusion Screening",
  risk_assessments:          "Risk Assessments",
  incident_response:         "Incident Response",
  physical_safeguards:       "Physical Safeguards",
  data_protection:           "Data Protection",
  change_management:         "Change Management",
  breach_notification:       "Breach Notification",
  integration_credentials:   "Integration Credentials",
};

const AUTOMATION_LABELS: Record<string, { label: string; tone: Variant }> = {
  fully_automated:    { label: "Fully automated",   tone: "success" },
  semi_automated:     { label: "Semi-automated",    tone: "info" },
  document_upload:    { label: "Document upload",   tone: "warning" },
  manual_attestation: { label: "Manual attestation", tone: "muted" },
};

export default function ComplianceBrowser({
  practiceId,
  controls,
  initialFramework,
  initialCategory,
  initialHealthcareCategory,
  initialAudience,
  initialStatus,
}: {
  practiceId: string;
  controls: ControlRow[];
  initialFramework: string | null;
  initialCategory: string | null;
  initialHealthcareCategory: string | null;
  initialAudience: string | null;
  initialStatus: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [framework, setFramework] = useState<string | null>(initialFramework);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [healthcareCategory, setHealthcareCategory] = useState<string | null>(initialHealthcareCategory);
  const [audience, setAudience] = useState<string | null>(initialAudience);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [attestingId, setAttestingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function uploadEvidenceFor(control: ControlRow, file: File) {
    if (!control.primary_evidence_check_id) return;
    setActionError(null);
    setUploadingId(control.id);
    try {
      // 1. Mint signed upload URL
      const signRes = await fetch("/api/evidence/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidence_check_id: control.primary_evidence_check_id,
          file_name: file.name,
          file_size: file.size,
        }),
      });
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Sign request failed (${signRes.status})`);
      }
      const { signed_url, path } = (await signRes.json()) as { signed_url: string; path: string };

      // 2. PUT the file directly to Supabase Storage
      const putRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      // 3. Finalize — runs the unified evidence flow
      const finRes = await fetch("/api/evidence/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidence_check_id: control.primary_evidence_check_id,
          path,
          file_name: file.name,
        }),
      });
      if (!finRes.ok) {
        const err = await finRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Finalize failed (${finRes.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setUploadingId(null);
    }
  }

  async function attestControl(control: ControlRow) {
    if (!control.primary_evidence_check_id) return;
    setActionError(null);
    setAttestingId(control.id);
    try {
      const res = await fetch("/api/evidence/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence_check_id: control.primary_evidence_check_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Attestation failed (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setAttestingId(null);
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(controls.map((c) => c.category))).sort(),
    [controls]
  );
  const healthcareCategoriesPresent = useMemo(
    () =>
      Array.from(new Set(controls.map((c) => c.healthcare_category).filter(Boolean))).sort() as string[],
    [controls]
  );
  const allFrameworks = ["HIPAA", "SOC2", "ISO27001", "GDPR"];

  const filtered = controls.filter((c) => {
    if (framework && !c.frameworks.includes(framework)) return false;
    if (category && c.category !== category) return false;
    if (healthcareCategory && c.healthcare_category !== healthcareCategory) return false;
    if (audience && c.audience !== audience) return false;
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
        description="One control, many frameworks. Each control answers what the practice must do, what proves it, how Fortify checks it, who owns it, and how to fix a failure."
      />

      {/* Filters — frameworks */}
      <Card className="px-4 py-3 mb-3 flex flex-wrap items-center gap-2">
        <FilterChip label="All frameworks" active={!framework} onClick={() => setFramework(null)} />
        {allFrameworks.map((fw) => (
          <FilterChip
            key={fw}
            label={fw}
            active={framework === fw}
            tone={FRAMEWORK_TONE[fw]}
            onClick={() => setFramework(framework === fw ? null : fw)}
          />
        ))}
      </Card>

      {/* Filters — second row: healthcare cat / category / audience / status */}
      <Card className="px-4 py-3 mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-quaternary)] mr-2">Filter</span>
        <select
          value={healthcareCategory ?? ""}
          onChange={(e) => setHealthcareCategory(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">All healthcare workflows</option>
          {healthcareCategoriesPresent.map((hc) => (
            <option key={hc} value={hc} className="bg-black">
              {HEALTHCARE_CATEGORY_LABELS[hc] ?? hc.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={audience ?? ""}
          onChange={(e) => setAudience(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">Customer + Fortify</option>
          <option value="customer" className="bg-black">Practice-owned only</option>
          <option value="fortify_internal" className="bg-black">Fortify-managed only</option>
        </select>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <option value="" className="bg-black">All security categories</option>
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
          const isFortifyManaged = c.audience === "fortify_internal";
          const automation = c.automation_status ? AUTOMATION_LABELS[c.automation_status] : null;
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
                    {isFortifyManaged && <Badge variant="info">Fortify-managed</Badge>}
                    {automation && <Badge variant={automation.tone}>{automation.label}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--color-tertiary)] uppercase tracking-wider">
                    {c.healthcare_category && (
                      <>
                        <span>{HEALTHCARE_CATEGORY_LABELS[c.healthcare_category] ?? c.healthcare_category}</span>
                        <span>·</span>
                      </>
                    )}
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
                <div className="border-t border-[var(--color-border-subtle)] px-5 py-5 bg-[var(--color-surface)] space-y-5">
                  <Section label="What the practice does">
                    <p className="text-sm text-[var(--color-secondary)] leading-relaxed">{c.description}</p>
                  </Section>

                  {c.evidence_summary && (
                    <Section label="What proves it">
                      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">{c.evidence_summary}</p>
                    </Section>
                  )}

                  {c.remediation_guide && (
                    <Section label="How to fix a failure">
                      <div
                        className="control-remediation text-sm text-[var(--color-secondary)] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: marked.parse(c.remediation_guide) as string }}
                      />
                    </Section>
                  )}

                  {c.report_output_text && (
                    <Section label="Attestation statement (when compliant)">
                      <p className="text-sm italic text-[var(--color-tertiary)] leading-relaxed border-l-2 border-[var(--color-border-strong)] pl-3">
                        “{c.report_output_text}”
                      </p>
                    </Section>
                  )}

                  {(c.last_verified_at || c.latest_evidence_at) && (
                    <div className="font-mono text-[11px] text-[var(--color-quaternary)] space-y-0.5">
                      {c.latest_evidence_at && (
                        <p>
                          Latest evidence: <span className="text-[var(--color-tertiary)]">{c.latest_evidence_status ?? "—"}</span>
                          {" · "}
                          {new Date(c.latest_evidence_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                          {c.latest_evidence_file && (
                            <span className="text-[var(--color-tertiary)] ml-2">· file on record</span>
                          )}
                        </p>
                      )}
                      {c.last_verified_at && (
                        <p>
                          Control verified:{" "}
                          {new Date(c.last_verified_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                  )}

                  {!isFortifyManaged && (
                    <div className="space-y-2 pt-1">
                      {/* Document upload (only when this control has a document_upload check) */}
                      {c.automation_status === "document_upload" && c.primary_evidence_check_id && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            className={`text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-default)] cursor-pointer hover:border-[var(--color-border-strong)] transition-colors ${
                              uploadingId === c.id ? "opacity-50 cursor-wait" : ""
                            }`}
                          >
                            {uploadingId === c.id ? "Uploading…" : "Upload evidence document"}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingId === c.id}
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadEvidenceFor(c, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <span className="text-[11px] text-[var(--color-quaternary)]">PDF / image / document</span>
                        </div>
                      )}

                      {/* Manual attestation */}
                      {c.automation_status === "manual_attestation" && c.primary_evidence_check_id && (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={attestingId === c.id}
                          onClick={() => attestControl(c)}
                        >
                          Attest now
                        </Button>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={isSaving}
                          onClick={() => setStatusOnControl(c, "compliant")}
                        >
                          Override: mark compliant
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => setStatusOnControl(c, "non_compliant")}
                        >
                          Override: non-compliant
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {actionError && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-[var(--color-surface-raised)] border border-[var(--color-danger)] rounded-md px-4 py-3 text-sm text-[var(--color-primary)] shadow-lg">
          <strong className="text-[var(--color-danger)]">Error: </strong>{actionError}
          <button onClick={() => setActionError(null)} className="ml-3 text-[var(--color-tertiary)] hover:text-[var(--color-primary)]">×</button>
        </div>
      )}

      <style>{`
        .control-remediation strong { color: var(--color-primary); font-weight: 600; }
        .control-remediation p { margin: 6px 0; }
        .control-remediation ol, .control-remediation ul { margin: 6px 0 6px 20px; }
        .control-remediation li { margin: 3px 0; }
        .control-remediation code { font-family: var(--font-mono, ui-monospace, monospace); background: var(--color-surface-raised); padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
      `}</style>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-2">{label}</div>
      {children}
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
