"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { InformationData, OnboardingLocation } from "./types";
import { EMPTY_LOCATION } from "./types";

interface Props {
  data: InformationData;
  onChange: (d: InformationData) => void;
  onContinue: () => void;
  isLast: boolean;
}

const EMP_OPTIONS: InformationData["employee_range"][] = ["1-20", "21-50", "51+"];
const LOC_OPTIONS: InformationData["location_count_range"][] = ["1-2", "3-5", "5+"];

export default function StepInformation({ data, onChange, onContinue, isLast }: Props) {
  // Per range: minimum allowed count, and how many forms we auto-populate on first selection.
  const { minLocations, autoPopulate, allowExtra } =
    data.location_count_range === "1-2" ? { minLocations: 1, autoPopulate: 2, allowExtra: false } :
    data.location_count_range === "3-5" ? { minLocations: 3, autoPopulate: 5, allowExtra: false } :
    data.location_count_range === "5+"  ? { minLocations: 5, autoPopulate: 5, allowExtra: true  } :
                                          { minLocations: 1, autoPopulate: 1, allowExtra: false };

  // Ensure locations array reaches the auto-populate count when a range is first selected,
  // but never trims existing entries below it (admin may have added more under 5+).
  const locs = [...data.locations];
  while (locs.length < autoPopulate) locs.push({ ...EMPTY_LOCATION });

  // For the bounded ranges (1-2, 3-5), cap the array at the auto-populate ceiling.
  if (!allowExtra && locs.length > autoPopulate) {
    locs.length = autoPopulate;
  }

  const canRemove = locs.length > minLocations;
  const canAdd = allowExtra;

  function updateLocation(idx: number, patch: Partial<OnboardingLocation>) {
    const next = locs.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...data, locations: next });
  }
  function addLocation() {
    if (!canAdd) return;
    onChange({ ...data, locations: [...locs, { ...EMPTY_LOCATION }] });
  }
  function removeLocation(idx: number) {
    if (!canRemove) return;
    onChange({ ...data, locations: locs.filter((_, i) => i !== idx) });
  }

  const isLocationComplete = (l: OnboardingLocation) =>
    l.street_1.trim() && l.city.trim() && l.region.trim() && l.postal_code.trim();

  const allLocationsComplete = locs.every(isLocationComplete);

  const valid =
    data.practice_name.trim().length > 0 &&
    data.description.trim().length > 0 &&
    !!data.employee_range &&
    !!data.location_count_range &&
    allLocationsComplete;

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardBody>
          <h2 className="font-display text-xl text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
            About the practice
          </h2>
          <p className="text-sm text-[var(--color-tertiary)] mb-6">
            Sets the foundation of your workspace. You can change these later.
          </p>

          <div className="space-y-5">
            <Field label="Practice name" required>
              <input
                value={data.practice_name}
                onChange={(e) => onChange({ ...data, practice_name: e.target.value })}
                placeholder="e.g. Cedar Park Family Medicine"
                className="onb-input"
                maxLength={120}
              />
            </Field>
            <Field label="Describe your practice" required>
              <input
                value={data.description}
                onChange={(e) => onChange({ ...data, description: e.target.value })}
                placeholder="Dental, Primary, etc"
                className="onb-input"
                maxLength={120}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Sizing */}
      <Card>
        <CardBody>
          <h2 className="font-display text-xl text-[var(--color-primary)] mb-5" style={{ letterSpacing: "-0.015em" }}>
            Size
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Number of employees" required>
              <div className="grid grid-cols-3 gap-2">
                {EMP_OPTIONS.map((opt) => (
                  <OptionPill
                    key={opt}
                    selected={data.employee_range === opt}
                    onClick={() => onChange({ ...data, employee_range: opt })}
                  >
                    {opt}
                  </OptionPill>
                ))}
              </div>
            </Field>
            <Field label="Number of locations" required>
              <div className="grid grid-cols-3 gap-2">
                {LOC_OPTIONS.map((opt) => (
                  <OptionPill
                    key={opt}
                    selected={data.location_count_range === opt}
                    onClick={() => onChange({ ...data, location_count_range: opt })}
                  >
                    {opt}
                  </OptionPill>
                ))}
              </div>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Locations */}
      {data.location_count_range && (
        <Card>
          <CardBody>
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.015em" }}>
                  Locations
                </h2>
                <p className="text-sm text-[var(--color-tertiary)] mt-1">
                  Each physical location needs an address for compliance scoping.
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] mt-2">
                  {locs.length} of {data.location_count_range} · minimum {minLocations}
                </p>
              </div>
              {canAdd && (
                <Button onClick={addLocation} variant="secondary" size="sm">+ Add location</Button>
              )}
            </div>

            <div className="space-y-4">
              {locs.map((loc, idx) => (
                <div key={idx} className="surface rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-300/80">
                      Location {idx + 1}
                    </p>
                    {canRemove ? (
                      <button
                        onClick={() => removeLocation(idx)}
                        className="text-xs text-[var(--color-tertiary)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--color-quaternary)]"
                        title={`Minimum ${minLocations} location${minLocations === 1 ? "" : "s"} for this range`}
                      >
                        Required
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Label (optional)">
                      <input
                        value={loc.label ?? ""}
                        onChange={(e) => updateLocation(idx, { label: e.target.value })}
                        placeholder="HQ, North Office, etc."
                        className="onb-input"
                      />
                    </Field>
                    <Field label="Street address" required>
                      <input
                        value={loc.street_1}
                        onChange={(e) => updateLocation(idx, { street_1: e.target.value })}
                        placeholder="123 Main Street"
                        className="onb-input"
                      />
                    </Field>
                    <Field label="Suite / unit (optional)">
                      <input
                        value={loc.street_2 ?? ""}
                        onChange={(e) => updateLocation(idx, { street_2: e.target.value })}
                        placeholder="Suite 200"
                        className="onb-input"
                      />
                    </Field>
                    <Field label="City" required>
                      <input
                        value={loc.city}
                        onChange={(e) => updateLocation(idx, { city: e.target.value })}
                        className="onb-input"
                      />
                    </Field>
                    <Field label="State / region" required>
                      <input
                        value={loc.region}
                        onChange={(e) => updateLocation(idx, { region: e.target.value })}
                        placeholder="TX"
                        className="onb-input"
                      />
                    </Field>
                    <Field label="ZIP / postal code" required>
                      <input
                        value={loc.postal_code}
                        onChange={(e) => updateLocation(idx, { postal_code: e.target.value })}
                        className="onb-input"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onClick={onContinue} disabled={!valid} variant="primary" size="lg">
          {isLast ? "Save & review" : "Continue"}
        </Button>
      </div>

      <FormStyles />
    </div>
  );
}

/* ───────────────── helpers ───────────────── */

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

function OptionPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`h-10 rounded-md text-sm font-medium transition-all border ${
        selected
          ? "text-white bg-violet-500/15 border-violet-400/60"
          : "text-[var(--color-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-primary)]"
      }`}
      style={selected ? { boxShadow: "0 0 16px rgba(139,92,246,0.25)" } : undefined}
    >
      {children}
    </button>
  );
}

function FormStyles() {
  return (
    <style>{`
      .onb-input {
        width: 100%; height: 38px; background: transparent;
        border: 1px solid var(--color-border-default); border-radius: 6px;
        padding: 0 10px; color: var(--color-primary); font-size: 13px;
        transition: border-color 150ms ease;
      }
      .onb-input:focus { border-color: var(--color-accent); outline: none; }
      .onb-input::placeholder { color: var(--color-quaternary); }
    `}</style>
  );
}
