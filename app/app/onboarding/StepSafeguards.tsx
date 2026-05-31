"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SafeguardsData } from "./types";

interface Props {
  data: SafeguardsData;
  onChange: (d: SafeguardsData) => void;
  onContinue: () => void;
  onBack: () => void;
  isLast: boolean;
}

const PLATFORMS: { key: string; label: string; description: string; auth_url?: string; perms?: string }[] = [
  {
    key: "microsoft_365",
    label: "Microsoft 365",
    description: "MFA enforcement, audit logs, BitLocker on managed devices.",
    perms: "User.Read.All · AuditLog.Read.All · Reports.Read.All · DeviceManagementManagedDevices.Read.All",
  },
  {
    key: "google_workspace",
    label: "Google Workspace",
    description: "Workspace admin audit, 2-step verification status, Drive sharing.",
    perms: "Admin SDK reports + directory read scopes",
  },
  {
    key: "aws",
    label: "AWS",
    description: "IAM MFA, CloudTrail, S3 encryption posture.",
    perms: "Read-only IAM + CloudTrail + S3 audit role",
  },
  {
    key: "datto",
    label: "Datto / Backup",
    description: "Backup health and quarterly restore-test attestation.",
    perms: "Backup status read",
  },
  {
    key: "endpoint_edr",
    label: "Endpoint security (EDR)",
    description: "SentinelOne, CrowdStrike, Defender — endpoint protection coverage.",
    perms: "Read-only events + asset inventory",
  },
  {
    key: "rmm",
    label: "RMM / patch mgmt",
    description: "ConnectWise, Datto RMM — patch level + missing updates.",
    perms: "Read-only assets + patch state",
  },
];

const TIME_WINDOWS: { value: NonNullable<SafeguardsData["assistance_window"]>; label: string }[] = [
  { value: "morning",   label: "Morning (9 am – 12 pm local)" },
  { value: "afternoon", label: "Afternoon (12 – 4 pm local)" },
  { value: "evening",   label: "Evening (4 – 6 pm local)" },
  { value: "flexible",  label: "Flexible — propose a time" },
];

export default function StepSafeguards({ data, onChange, onContinue, onBack, isLast }: Props) {
  // Valid if mode is chosen; for manual at least one integration OR explicit "skip for later" implicit;
  // for schedule require date+window
  const validManual = data.mode === "manual";
  const validSchedule =
    data.mode === "schedule" && !!data.assistance_date && !!data.assistance_window;
  const valid = validManual || validSchedule;

  // Earliest scheduled assist = tomorrow. Computed post-mount to avoid
  // SSR/hydration mismatch on the <input min={...}> attribute.
  const [minDate, setMinDate] = useState("");
  // Post-mount initialization (avoids SSR/hydration mismatch on time-dependent attribute)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }, []);

  function toggleIntegration(key: string) {
    const next = data.integrations.includes(key)
      ? data.integrations.filter((k) => k !== key)
      : [...data.integrations, key];
    onChange({ ...data, integrations: next });
  }

  return (
    <div className="space-y-6">
      <Card variant="raised">
        <CardBody>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-3">
            Step 4 · Safeguards
          </p>
          <h2 className="font-display text-xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.015em" }}>
            Connect systems for tracking, monitoring, and evidence
          </h2>
          <p className="text-sm text-[var(--color-secondary)] leading-[1.7]">
            Integrations let Fortify collect compliance evidence automatically, monitor for
            configuration drift, and stay audit-ready 24/7. Set this up yourself, or book
            time with our team to do it together.
          </p>
        </CardBody>
      </Card>

      {/* Mode picker */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ModeCard
              selected={data.mode === "manual"}
              onClick={() => onChange({ ...data, mode: "manual" })}
              title="Integrate manually"
              body="I'll pick the systems and connect them myself. Guided, self-service."
              tone="violet"
            />
            <ModeCard
              selected={data.mode === "schedule"}
              onClick={() => onChange({ ...data, mode: "schedule" })}
              title="Schedule assistance"
              body="Book a 30-minute call. We'll integrate your environment with you, live."
              tone="cyan"
            />
          </div>
        </CardBody>
      </Card>

      {/* Manual: platforms to integrate */}
      {data.mode === "manual" && (
        <Card>
          <CardBody>
            <h3 className="font-display text-lg text-[var(--color-primary)] mb-1.5" style={{ letterSpacing: "-0.015em" }}>
              Choose platforms to integrate
            </h3>
            <p className="text-xs text-[var(--color-tertiary)] mb-5">
              Select any number. You can add more later in <span className="text-[var(--color-secondary)]">Workspace › Integrations</span>.
            </p>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.key}
                  className={`flex items-start gap-3 px-4 py-3.5 rounded-md cursor-pointer transition-all border ${
                    data.integrations.includes(p.key)
                      ? "border-violet-400/50 bg-violet-500/10"
                      : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
                  }`}
                  style={data.integrations.includes(p.key) ? { boxShadow: "0 0 14px rgba(139,92,246,0.15)" } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={data.integrations.includes(p.key)}
                    onChange={() => toggleIntegration(p.key)}
                    className="accent-violet-500 mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-primary)]">{p.label}</p>
                    <p className="text-xs text-[var(--color-tertiary)] mt-0.5 leading-relaxed">{p.description}</p>
                    {p.perms && (
                      <p className="font-mono text-[10px] text-[var(--color-quaternary)] mt-1.5">
                        Required scopes · {p.perms}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--color-tertiary)] mt-4 leading-relaxed">
              You can proceed without selecting any — the actual OAuth connections happen inside
              the workspace after onboarding. This list pre-queues them so we know what to suggest first.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Schedule assistance */}
      {data.mode === "schedule" && (
        <Card>
          <CardBody>
            <h3 className="font-display text-lg text-[var(--color-primary)] mb-1.5" style={{ letterSpacing: "-0.015em" }}>
              Book your integration call
            </h3>
            <p className="text-xs text-[var(--color-tertiary)] mb-5">
              30 minutes via video. We&apos;ll confirm the exact time by email.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Preferred date" required>
                <input
                  type="date"
                  min={minDate}
                  value={data.assistance_date ?? ""}
                  onChange={(e) => onChange({ ...data, assistance_date: e.target.value })}
                  className="onb-input"
                />
              </Field>
              <Field label="Time window" required>
                <select
                  value={data.assistance_window ?? ""}
                  onChange={(e) =>
                    onChange({ ...data, assistance_window: e.target.value as SafeguardsData["assistance_window"] })
                  }
                  className="onb-input"
                >
                  <option value="" className="bg-black">Select a window</option>
                  {TIME_WINDOWS.map((w) => (
                    <option key={w.value} value={w.value} className="bg-black">
                      {w.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Best phone number (optional)">
                <input
                  type="tel"
                  value={data.assistance_phone ?? ""}
                  onChange={(e) => onChange({ ...data, assistance_phone: e.target.value })}
                  placeholder="(555) 555-5555"
                  className="onb-input"
                />
              </Field>
              <Field label="Anything we should know (optional)">
                <input
                  value={data.assistance_notes ?? ""}
                  onChange={(e) => onChange({ ...data, assistance_notes: e.target.value })}
                  placeholder="Pre-existing tools, urgent audit, etc."
                  className="onb-input"
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between pt-4 gap-3 flex-wrap">
        <Button onClick={onBack} variant="ghost" size="md">← Back</Button>
        <Button onClick={onContinue} disabled={!valid} variant="primary" size="lg">
          {isLast ? "Save & review" : "Continue"}
        </Button>
      </div>

      <style>{`
        .onb-input {
          width: 100%; height: 38px; background: transparent;
          border: 1px solid var(--color-border-default); border-radius: 6px;
          padding: 0 10px; color: var(--color-primary); font-size: 13px;
          transition: border-color 150ms ease;
        }
        .onb-input:focus { border-color: var(--color-accent); outline: none; }
      `}</style>
    </div>
  );
}

function ModeCard({
  selected,
  onClick,
  title,
  body,
  tone,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
  tone: "violet" | "cyan";
}) {
  const accent = tone === "violet" ? "rgba(139,92,246," : "rgba(6,182,212,";
  return (
    <button
      onClick={onClick}
      type="button"
      className={`text-left px-6 py-6 rounded-xl transition-all border ${
        selected
          ? "border-violet-400/60 bg-violet-500/10"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]"
      }`}
      style={selected ? { boxShadow: `0 0 20px ${accent}0.25)` } : undefined}
    >
      <p className="text-sm font-semibold text-[var(--color-primary)] mb-1.5">{title}</p>
      <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">{body}</p>
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1.5 block">
        {label}{required && <span className="text-[var(--color-danger)] ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
