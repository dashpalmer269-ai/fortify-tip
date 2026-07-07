"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const STATEMENT =
  "I certify that I am authorized to attest on behalf of this practice, that I have reviewed this assessment, and that the information herein is accurate to the best of my knowledge as of the date signed.";

export default function SignPanel({ attestationId }: { attestationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"e_signature" | "print_and_sign">("e_signature");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [affirmed, setAffirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && title.trim().length >= 2 && (mode === "print_and_sign" || affirmed);

  async function sign() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/attestations/${attestationId}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: mode,
          signer_name: name.trim(),
          signer_title: title.trim(),
          affirmed: mode === "e_signature" ? affirmed : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Signing failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="raised">
      <CardBody>
        <h2 className="font-display text-lg text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
          Sign this attestation
        </h2>
        <p className="text-xs text-[var(--color-tertiary)] mb-5">
          Choose how the practice security officer will attest.
        </p>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <ModeCard
            selected={mode === "e_signature"}
            onClick={() => setMode("e_signature")}
            title="E-signature"
            body="Sign in-product now. Records an immutable signed record."
          />
          <ModeCard
            selected={mode === "print_and_sign"}
            onClick={() => setMode("print_and_sign")}
            title="Print & sign"
            body="Download the document for a wet-ink signature, recorded here."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Signer name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Sarah Chen" className="att-input" />
          </Field>
          <Field label="Title / role" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Security Officer" className="att-input" />
          </Field>
        </div>

        {mode === "e_signature" && (
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={affirmed}
              onChange={(e) => setAffirmed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[13px] text-[var(--color-secondary)] leading-relaxed">{STATEMENT}</span>
          </label>
        )}

        {mode === "print_and_sign" && (
          <p className="text-[13px] text-[var(--color-tertiary)] leading-relaxed mb-4">
            Recording this marks the attestation as signed in Fortify and captures the signer of record. Download the
            printable document below, sign it physically, and retain the wet-ink copy as your legal artifact.
          </p>
        )}

        {error && (
          <div className="text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <Button onClick={sign} loading={busy} disabled={!valid} variant="primary" size="md">
          {mode === "e_signature" ? "Sign electronically" : "Record signature"}
        </Button>

        <style>{`
          .att-input { width:100%; height:38px; background:transparent; border:1px solid var(--color-border-default); border-radius:6px; padding:0 10px; color:var(--color-primary); font-size:13px; }
          .att-input:focus { border-color:var(--color-accent); outline:none; }
        `}</style>
      </CardBody>
    </Card>
  );
}

function ModeCard({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-lg border transition-all ${
        selected ? "border-violet-400/60 bg-violet-500/10" : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">{title}</p>
      <p className="text-[11px] text-[var(--color-tertiary)] leading-relaxed">{body}</p>
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
