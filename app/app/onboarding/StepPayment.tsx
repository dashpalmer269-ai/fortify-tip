"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANS } from "@/lib/billing/plans";
import type { PaymentData } from "./types";

interface Props {
  data: PaymentData;
  onChange: (d: PaymentData) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

export default function StepPayment({ data, onChange, onSubmit, onBack, submitting }: Props) {
  const selectedPlan = PLANS.find((p) => p.id === data.selected_plan);
  const valid = !!data.selected_plan;

  return (
    <div className="space-y-6">
      <Card variant="raised">
        <CardBody>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-3">
            Step 5 · Payment
          </p>
          <h2 className="font-display text-xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.015em" }}>
            Choose your plan
          </h2>
          <p className="text-sm text-[var(--color-secondary)] leading-[1.7]">
            All plans include the unified control library, AI-assisted remediation,
            and automated evidence collection. You can change
            plans or cancel at any time from <span className="text-[var(--color-secondary)]">Workspace › Billing</span>.
          </p>
        </CardBody>
      </Card>

      {/* Plan selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLANS.map((p) => {
          const selected = data.selected_plan === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onChange({ selected_plan: p.id as PaymentData["selected_plan"] })}
              type="button"
              className={`text-left rounded-xl p-6 h-full transition-all border ${
                selected
                  ? "border-violet-400/60 bg-violet-500/10"
                  : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)]"
              }`}
              style={selected ? { boxShadow: "0 0 26px rgba(139,92,246,0.3)" } : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[var(--color-primary)] font-medium">{p.name}</p>
                {p.badge && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
                {p.description}
              </p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-display text-3xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                  ${p.monthly_price_usd.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--color-tertiary)]">/mo</span>
              </div>
              <ul className="space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="text-xs text-[var(--color-secondary)] flex gap-2">
                    <span className="text-violet-400 shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className={`mt-4 text-xs font-medium ${selected ? "text-violet-300" : "text-[var(--color-tertiary)]"}`}>
                {selected ? "Selected" : "Choose plan"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Order summary — Stripe-style */}
      {selectedPlan && (
        <Card>
          <CardBody>
            <h3 className="font-display text-lg text-[var(--color-primary)] mb-5" style={{ letterSpacing: "-0.015em" }}>
              Order summary
            </h3>
            <dl className="divide-y divide-[var(--color-border-subtle)] mb-5">
              <Row label="Plan" value={selectedPlan.name} />
              <Row label="Billing" value="Monthly · charged on the 1st" />
              <Row label="Trial" value="14 days free · no card required" />
              <Row label="Total today" value="$0.00" highlight />
              <Row
                label={`After trial`}
                value={`$${selectedPlan.monthly_price_usd.toLocaleString()}.00 / month`}
              />
            </dl>
            <p className="text-[11px] text-[var(--color-tertiary)] leading-relaxed mb-2">
              No payment information is required to start. We&apos;ll email you 3 days before your trial ends.
              You can cancel any time before then — no charge.
            </p>
            <p className="text-[11px] text-[var(--color-quaternary)] leading-relaxed">
              By submitting, you agree to Fortify&apos;s{" "}
              <a href="#" className="text-[var(--color-tertiary)] hover:text-[var(--color-primary)] underline underline-offset-2">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-[var(--color-tertiary)] hover:text-[var(--color-primary)] underline underline-offset-2">
                Privacy Policy
              </a>
              , and you confirm you have authority to enter this agreement on behalf of the practice.
              Fortify operates as a HIPAA-aware vendor; a signed BAA is available at the
              Practice tier and above before any PHI is processed.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between pt-4 gap-3 flex-wrap">
        <Button onClick={onBack} variant="ghost" size="md">← Back</Button>
        <Button onClick={onSubmit} loading={submitting} disabled={!valid} variant="primary" size="lg">
          Submit
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
      <dt className={`font-mono text-[10px] uppercase tracking-[0.25em] ${highlight ? "text-[var(--color-primary)]" : "text-[var(--color-tertiary)]"}`}>
        {label}
      </dt>
      <dd className={`text-sm tabular-nums ${highlight ? "text-[var(--color-primary)] font-medium" : "text-[var(--color-secondary)]"}`}>
        {value}
      </dd>
    </div>
  );
}
