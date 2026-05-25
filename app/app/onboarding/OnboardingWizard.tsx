"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import Stepper from "./Stepper";
import StepInformation from "./StepInformation";
import StepFortification from "./StepFortification";
import StepSafeguards from "./StepSafeguards";
import StepPayment from "./StepPayment";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  defaultState,
  type StepKey,
  type OnboardingState,
  type OnboardingLocation,
} from "./types";

const ORDER: StepKey[] = ["information", "fortification", "safeguards", "payment"];
const LOCAL_STORAGE_KEY = "fortify_onboarding_state_v1";

interface ExistingPractice {
  id: string;
  name: string;
  description: string | null;
  employee_range: string | null;
  location_count_range: string | null;
  current_status: string | null;
  upcoming_audit_window: string | null;
  selected_plan: string | null;
  onboarding_step: string | null;
}

interface Props {
  userEmail: string;
  existingPractice: ExistingPractice | null;
  existingLocations: Array<{
    label: string | null;
    street_1: string;
    street_2: string | null;
    city: string;
    region: string;
    postal_code: string;
  }>;
  existingIntegrations: string[];
}

export default function OnboardingWizard({
  userEmail,
  existingPractice,
  existingLocations,
  existingIntegrations,
}: Props) {
  const router = useRouter();

  const [state, setState] = useState<OnboardingState>(() => {
    // Hydrate from DB if there's an existing in-progress practice
    if (existingPractice) {
      return {
        information: {
          practice_name: existingPractice.name ?? "",
          description: existingPractice.description ?? "",
          employee_range: (existingPractice.employee_range as OnboardingState["information"]["employee_range"]) ?? "",
          location_count_range:
            (existingPractice.location_count_range as OnboardingState["information"]["location_count_range"]) ?? "",
          locations:
            existingLocations.length > 0
              ? existingLocations.map((l) => ({
                  label: l.label ?? "",
                  street_1: l.street_1,
                  street_2: l.street_2 ?? "",
                  city: l.city,
                  region: l.region,
                  postal_code: l.postal_code,
                }))
              : defaultState().information.locations,
        },
        fortification: {
          current_status: (existingPractice.current_status as OnboardingState["fortification"]["current_status"]) ?? "",
          upcoming_audit_window:
            (existingPractice.upcoming_audit_window as OnboardingState["fortification"]["upcoming_audit_window"]) ?? "",
        },
        safeguards: {
          mode: existingIntegrations.length > 0 ? "manual" : "",
          integrations: existingIntegrations,
          assistance_window: "",
        },
        payment: {
          selected_plan: (existingPractice.selected_plan as OnboardingState["payment"]["selected_plan"]) ?? "",
        },
      };
    }
    // Otherwise try localStorage cache
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached) as OnboardingState;
        } catch { /* ignore */ }
      }
    }
    return defaultState();
  });

  const rawStep = existingPractice?.onboarding_step ?? "information";
  const initialStep: StepKey = ORDER.includes(rawStep as StepKey)
    ? (rawStep as StepKey)
    : "payment";
  const [step, setStep] = useState<StepKey>(initialStep);
  const [furthest, setFurthest] = useState<StepKey>(step);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist state to localStorage as a safety net
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function advanceFurthest(next: StepKey) {
    const nextIdx = ORDER.indexOf(next);
    const curIdx = ORDER.indexOf(furthest);
    if (nextIdx > curIdx) setFurthest(next);
  }

  function go(next: StepKey) {
    setStep(next);
    advanceFurthest(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function nextOf(s: StepKey): StepKey {
    const idx = ORDER.indexOf(s);
    return ORDER[Math.min(idx + 1, ORDER.length - 1)];
  }
  function prevOf(s: StepKey): StepKey {
    const idx = ORDER.indexOf(s);
    return ORDER[Math.max(idx - 1, 0)];
  }

  async function finalSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, existing_practice_id: existingPractice?.id ?? null }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Submission failed");
        return;
      }
      // Clear cache
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      router.push("/app/onboarding/welcome");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      {/* Soft starfield in background — atmosphere but calm */}
      <div className="opacity-50">
        <StarfieldBackground />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <Link
            href="/"
            aria-label="Fortify — home"
            className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors"
          >
            Fortify
          </Link>
          <p className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)]">
            {userEmail}
          </p>
        </header>

        <main className="flex-1 px-6 sm:px-10 py-10 max-w-4xl w-full mx-auto">
          {/* Page title */}
          <div className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
              Onboarding
            </p>
            <h1 className="font-display text-[clamp(36px,4.5vw,56px)] text-[var(--color-primary)] leading-[1.02]" style={{ letterSpacing: "-0.025em" }}>
              {step === "information" && "Information"}
              {step === "fortification" && "Fortification"}
              {step === "safeguards" && "Safeguards"}
              {step === "payment" && "Payment"}
            </h1>
          </div>

          <Stepper current={step} furthest={furthest} onJump={(s) => setStep(s)} />

          {/* Active step */}
          {step === "information" && (
            <StepInformation
              data={state.information}
              onChange={(d) => setState({ ...state, information: d })}
              onContinue={() => go(nextOf(step))}
              isLast={false}
            />
          )}
          {step === "fortification" && (
            <StepFortification
              data={state.fortification}
              onChange={(d) => setState({ ...state, fortification: d })}
              onContinue={() => go(nextOf(step))}
              onBack={() => go(prevOf(step))}
              isLast={false}
            />
          )}
          {step === "safeguards" && (
            <StepSafeguards
              data={state.safeguards}
              onChange={(d) => setState({ ...state, safeguards: d })}
              onContinue={() => go(nextOf(step))}
              onBack={() => go(prevOf(step))}
              isLast={false}
            />
          )}
          {step === "payment" && (
            <StepPayment
              data={state.payment}
              onChange={(d) => setState({ ...state, payment: d })}
              onSubmit={() => setShowConfirm(true)}
              onBack={() => go(prevOf(step))}
              submitting={submitting}
            />
          )}
        </main>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <ConfirmSubmitModal
          state={state}
          onConfirm={finalSubmit}
          onEdit={() => {
            setShowConfirm(false);
            setStep("information");
          }}
          onClose={() => setShowConfirm(false)}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}

/* ───────── Confirm Submit modal ───────── */

function ConfirmSubmitModal({
  state,
  onConfirm,
  onEdit,
  onClose,
  submitting,
  error,
}: {
  state: OnboardingState;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <Card variant="raised">
          <CardBody className="py-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
              Review &amp; confirm
            </p>
            <h3 className="font-display text-2xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.02em" }}>
              Submit onboarding?
            </h3>
            <p className="text-sm text-[var(--color-tertiary)] mb-6">
              This finalizes your practice setup. You can edit details later from inside the workspace.
            </p>

            <dl className="space-y-2 mb-6">
              <SummaryRow label="Practice" value={state.information.practice_name || "—"} />
              <SummaryRow label="Type" value={state.information.description || "—"} />
              <SummaryRow
                label="Size"
                value={`${state.information.employee_range || "—"} employees · ${state.information.location_count_range || "—"} locations`}
              />
              <SummaryRow
                label="Current status"
                value={(state.fortification.current_status || "—").replace(/_/g, " ")}
              />
              <SummaryRow
                label="Upcoming audit"
                value={(state.fortification.upcoming_audit_window || "—").replace(/_/g, " ")}
              />
              <SummaryRow
                label="Safeguards setup"
                value={
                  state.safeguards.mode === "manual"
                    ? `Manual · ${state.safeguards.integrations.length} platforms`
                    : state.safeguards.mode === "schedule"
                    ? `Assistance · ${state.safeguards.assistance_date}`
                    : "—"
                }
              />
              <SummaryRow label="Plan" value={state.payment.selected_plan || "—"} />
            </dl>

            {error && (
              <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2 mb-4">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button onClick={onEdit} variant="secondary" size="md" disabled={submitting}>
                Edit
              </Button>
              <Button onClick={onConfirm} variant="primary" size="md" loading={submitting}>
                Confirm Submit
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--color-border-subtle)] last:border-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)]">{label}</dt>
      <dd className="text-sm text-[var(--color-primary)] capitalize text-right truncate max-w-[60%]">{value}</dd>
    </div>
  );
}
