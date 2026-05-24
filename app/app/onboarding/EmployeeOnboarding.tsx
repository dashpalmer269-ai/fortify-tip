"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ExistingProfile {
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  pending_practice_name: string | null;
  primary_address: Record<string, string> | null;
}

interface Props {
  userEmail: string;
  existingProfile: ExistingProfile | null;
}

export default function EmployeeOnboarding({ userEmail, existingProfile }: Props) {
  const router = useRouter();
  const ex = existingProfile;
  const exAddr = (ex?.primary_address ?? {}) as Record<string, string>;

  const [fullName, setFullName] = useState(ex?.full_name ?? "");
  const [jobTitle, setJobTitle] = useState(ex?.job_title ?? "");
  const [phone, setPhone] = useState(ex?.phone ?? "");
  const [practiceName, setPracticeName] = useState(ex?.pending_practice_name ?? "");
  const [addr, setAddr] = useState({
    street_1: exAddr.street_1 ?? "",
    street_2: exAddr.street_2 ?? "",
    city: exAddr.city ?? "",
    region: exAddr.region ?? "",
    postal_code: exAddr.postal_code ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    fullName.trim() &&
    jobTitle.trim() &&
    practiceName.trim() &&
    addr.street_1.trim() &&
    addr.city.trim() &&
    addr.region.trim() &&
    addr.postal_code.trim();

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/employee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          job_title: jobTitle.trim(),
          phone: phone.trim() || null,
          pending_practice_name: practiceName.trim(),
          primary_address: {
            street_1: addr.street_1.trim(),
            street_2: addr.street_2.trim() || null,
            city: addr.city.trim(),
            region: addr.region.trim(),
            postal_code: addr.postal_code.trim(),
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to save");
        return;
      }
      router.push("/pending");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-50">
        <StarfieldBackground />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
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

        <main className="flex-1 px-6 sm:px-10 py-10 max-w-2xl w-full mx-auto">
          <div className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
              Employee onboarding
            </p>
            <h1
              className="font-display text-[clamp(36px,4.5vw,56px)] text-[var(--color-primary)] leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Information
            </h1>
            <p className="text-sm text-[var(--color-tertiary)] mt-3 max-w-lg">
              We&apos;ll verify these details with your practice admin, then add you to the workspace.
            </p>
          </div>

          {/* About you */}
          <Card className="mb-4">
            <CardBody>
              <h2 className="font-display text-lg text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
                About you
              </h2>
              <p className="text-xs text-[var(--color-tertiary)] mb-5">
                The minimum your admin needs to identify and approve you.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name" required>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="emp-input" />
                </Field>
                <Field label="Your role at the practice" required>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Office Manager, RN, IT Lead"
                    className="emp-input"
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    className="emp-input"
                  />
                </Field>
                <Field label="Work email" hint="From sign-up">
                  <input value={userEmail} disabled className="emp-input opacity-60 cursor-not-allowed" />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Practice you work at */}
          <Card className="mb-4">
            <CardBody>
              <h2 className="font-display text-lg text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
                Practice you work at
              </h2>
              <p className="text-xs text-[var(--color-tertiary)] mb-5">
                Helps your admin confirm you&apos;re the right person.
              </p>

              <Field label="Practice name" required>
                <input
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  placeholder="e.g. Cedar Park Family Medicine"
                  className="emp-input"
                />
              </Field>
            </CardBody>
          </Card>

          {/* Primary work address */}
          <Card className="mb-8">
            <CardBody>
              <h2 className="font-display text-lg text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
                Primary work address
              </h2>
              <p className="text-xs text-[var(--color-tertiary)] mb-5">
                The location you&apos;re physically based at most of the time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Street address" required>
                    <input
                      value={addr.street_1}
                      onChange={(e) => setAddr({ ...addr, street_1: e.target.value })}
                      placeholder="123 Main Street"
                      className="emp-input"
                    />
                  </Field>
                </div>
                <Field label="Suite / unit (optional)">
                  <input
                    value={addr.street_2}
                    onChange={(e) => setAddr({ ...addr, street_2: e.target.value })}
                    placeholder="Suite 200"
                    className="emp-input"
                  />
                </Field>
                <Field label="City" required>
                  <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className="emp-input" />
                </Field>
                <Field label="State / region" required>
                  <input
                    value={addr.region}
                    onChange={(e) => setAddr({ ...addr, region: e.target.value })}
                    placeholder="TX"
                    className="emp-input"
                  />
                </Field>
                <Field label="ZIP / postal code" required>
                  <input
                    value={addr.postal_code}
                    onChange={(e) => setAddr({ ...addr, postal_code: e.target.value })}
                    className="emp-input"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <Button
            onClick={submit}
            loading={submitting}
            disabled={!valid}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Submit for verification
          </Button>

          <p className="text-xs text-[var(--color-tertiary)] text-center mt-4 leading-relaxed">
            Your admin will be notified. You&apos;ll get access as soon as they approve you.
          </p>

          <style>{`
            .emp-input {
              width: 100%; height: 38px; background: transparent;
              border: 1px solid var(--color-border-default); border-radius: 6px;
              padding: 0 10px; color: var(--color-primary); font-size: 13px;
              transition: border-color 150ms ease;
            }
            .emp-input:focus { border-color: var(--color-accent); outline: none; }
          `}</style>
        </main>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)]">
          {label}{required && <span className="text-[var(--color-danger)] ml-1">*</span>}
        </label>
        {hint && <span className="font-mono text-[10px] text-[var(--color-quaternary)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
