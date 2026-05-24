"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { FortificationData } from "./types";

interface Props {
  data: FortificationData;
  onChange: (d: FortificationData) => void;
  onContinue: () => void;
  onBack: () => void;
  isLast: boolean;
}

const STATUS_OPTIONS: { value: FortificationData["current_status"]; label: string; help: string }[] = [
  {
    value: "starting_brand_new",
    label: "Starting brand-new",
    help: "First time formalizing compliance for the practice.",
  },
  {
    value: "maintenance_needed",
    label: "Maintenance needed",
    help: "Posture exists but needs review, updates, or remediation.",
  },
  {
    value: "transfer_from_other",
    label: "Transferring from another platform",
    help: "Currently using Vanta, Drata, Compliancy Group, or similar.",
  },
];

const AUDIT_OPTIONS: { value: FortificationData["upcoming_audit_window"]; label: string }[] = [
  { value: "within_30_days",  label: "Yes — within 30 days" },
  { value: "within_60_days",  label: "Yes — within 60 days" },
  { value: "within_90_days",  label: "Yes — within 90 days" },
  { value: "beyond_90_days",  label: "No, or more than 90 days out" },
];

export default function StepFortification({ data, onChange, onContinue, onBack, isLast }: Props) {
  const valid = !!data.current_status && !!data.upcoming_audit_window;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card variant="raised">
        <CardBody>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-3">
            Why this step
          </p>
          <h2 className="font-display text-xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.015em" }}>
            One control library. Every framework.
          </h2>
          <p className="text-sm text-[var(--color-secondary)] leading-[1.7]">
            Fortify is a multi-framework compliance readiness platform built on a unified
            control-mapping engine. One safeguard — MFA, encryption, audit logging,
            workforce training — automatically credits HIPAA, SOC 2, ISO 27001, and GDPR
            wherever it applies. Tell us where you are and what&apos;s next so we can prioritize
            the right work first.
          </p>
        </CardBody>
      </Card>

      {/* Current status */}
      <Card>
        <CardBody>
          <h3 className="font-display text-lg text-[var(--color-primary)] mb-1.5" style={{ letterSpacing: "-0.015em" }}>
            Current status <span className="text-[var(--color-danger)]">*</span>
          </h3>
          <p className="text-xs text-[var(--color-tertiary)] mb-5">
            Where is the practice today?
          </p>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <RadioCard
                key={opt.value}
                name="current_status"
                value={opt.value!}
                label={opt.label}
                help={opt.help}
                selected={data.current_status === opt.value}
                onChange={() => onChange({ ...data, current_status: opt.value })}
              />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Audits */}
      <Card>
        <CardBody>
          <h3 className="font-display text-lg text-[var(--color-primary)] mb-1.5" style={{ letterSpacing: "-0.015em" }}>
            Upcoming audits? <span className="text-[var(--color-danger)]">*</span>
          </h3>
          <p className="text-xs text-[var(--color-tertiary)] mb-5">
            Helps us prioritize evidence collection on a realistic timeline.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AUDIT_OPTIONS.map((opt) => (
              <RadioCard
                key={opt.value}
                name="upcoming_audit_window"
                value={opt.value!}
                label={opt.label}
                selected={data.upcoming_audit_window === opt.value}
                onChange={() => onChange({ ...data, upcoming_audit_window: opt.value })}
                compact
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between pt-4 gap-3 flex-wrap">
        <Button onClick={onBack} variant="ghost" size="md">← Back</Button>
        <Button onClick={onContinue} disabled={!valid} variant="primary" size="lg">
          {isLast ? "Save & review" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function RadioCard({
  name,
  value,
  label,
  help,
  selected,
  onChange,
  compact = false,
}: {
  name: string;
  value: string;
  label: string;
  help?: string;
  selected: boolean;
  onChange: () => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 ${compact ? "px-4 py-3" : "px-5 py-4"} rounded-md cursor-pointer transition-all border ${
        selected
          ? "text-[var(--color-primary)] bg-violet-500/10 border-violet-400/50"
          : "text-[var(--color-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
      }`}
      style={selected ? { boxShadow: "0 0 18px rgba(139,92,246,0.18)" } : undefined}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
        className="accent-violet-500 mt-0.5 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-primary)]">{label}</p>
        {help && <p className="text-xs text-[var(--color-tertiary)] mt-1 leading-relaxed">{help}</p>}
      </div>
    </label>
  );
}
