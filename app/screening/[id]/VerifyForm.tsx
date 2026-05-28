"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function VerifyForm({ screeningId }: { screeningId: string }) {
  const router = useRouter();
  const [middleName, setMiddleName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = middleName.trim() || (addressLine.trim() && city.trim() && state.trim() && zip.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/screening/${screeningId}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          middle_name: middleName.trim() || undefined,
          address_line: addressLine.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Verification failed");
        return;
      }
      if (body.status === "cleared") {
        router.push("/pending");
      } else if (body.status === "blocked") {
        router.push(`/screening/${screeningId}/blocked`);
      } else {
        setError("Unexpected response");
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Middle name (optional)">
        <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Jane" className="screen-input" />
      </Field>

      <div className="border-t border-[var(--color-border-subtle)] pt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">
          Address from your most recent tax return
        </p>
        <div className="space-y-3">
          <Field label="Street address">
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="123 Main St" className="screen-input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px] gap-3">
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} className="screen-input" />
            </Field>
            <Field label="State">
              <input value={state} onChange={(e) => setState(e.target.value)} className="screen-input" placeholder="TX" />
            </Field>
            <Field label="ZIP">
              <input value={zip} onChange={(e) => setZip(e.target.value)} className="screen-input" />
            </Field>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" loading={submitting} disabled={!valid} variant="primary" size="lg" className="w-full">
        Continue
      </Button>

      <style>{`
        .screen-input {
          width: 100%; height: 38px; background: transparent;
          border: 1px solid var(--color-border-default); border-radius: 6px;
          padding: 0 10px; color: var(--color-primary); font-size: 13px;
          transition: border-color 150ms ease;
        }
        .screen-input:focus { border-color: var(--color-accent); outline: none; }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
