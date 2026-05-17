"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const SIZE_OPTIONS = [
  { value: "solo",   label: "Solo practitioner", help: "Just me" },
  { value: "small",  label: "Small practice",    help: "2–10 staff" },
  { value: "medium", label: "Mid-sized",         help: "11–50 staff" },
  { value: "large",  label: "Large practice",    help: "50+ staff" },
] as const;

const PRACTICE_TYPES = [
  { value: "medical",   label: "Medical / primary care" },
  { value: "dental",    label: "Dental" },
  { value: "therapy",   label: "Therapy / mental health" },
  { value: "specialty", label: "Specialty (cardio, derm, etc.)" },
  { value: "msp",       label: "Healthcare MSP / IT provider" },
] as const;

const FRAMEWORK_OPTIONS = [
  { code: "HIPAA",    label: "HIPAA",      required: true,  help: "Required for US healthcare" },
  { code: "SOC2",     label: "SOC 2",      required: false, help: "Often requested by enterprise partners" },
  { code: "ISO27001", label: "ISO 27001",  required: false, help: "International equivalent" },
  { code: "GDPR",     label: "GDPR",       required: false, help: "Required if any EU patients" },
];

export default function NewPracticeForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sizeTier, setSizeTier] = useState<typeof SIZE_OPTIONS[number]["value"]>("small");
  const [practiceType, setPracticeType] = useState<typeof PRACTICE_TYPES[number]["value"]>("medical");
  const [frameworks, setFrameworks] = useState<string[]>(["HIPAA"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFramework(code: string, required: boolean) {
    if (required) return;
    setFrameworks((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Your session expired. Please sign in again."); return; }

      const { data: practice, error: pErr } = await supabase
        .from("practices")
        .insert({
          name: name.trim(),
          size_tier: sizeTier,
          practice_type: practiceType,
          frameworks_enabled: frameworks,
          hipaa_covered_entity: true,
        })
        .select().single();
      if (pErr || !practice) { setError(pErr?.message ?? "Could not create the practice."); return; }

      const { error: puErr } = await supabase.from("practice_users").insert({
        practice_id: practice.id, user_id: user.id, role: "owner",
      });
      if (puErr) { setError(puErr.message); return; }

      const { data: baseline } = await supabase.from("controls").select("id").eq("healthcare_baseline", true);
      if (baseline?.length) {
        await supabase.from("practice_controls").insert(
          baseline.map((c) => ({ practice_id: practice.id, control_id: c.id, status: "not_started" as const }))
        );
      }

      router.push("/app/onboarding/invite-team");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Field label="Practice name">
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cedar Park Family Medicine" maxLength={120} className="onb-input"
            />
          </Field>

          <Field label="Practice type">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PRACTICE_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors border ${
                    practiceType === t.value
                      ? "text-[var(--color-primary)] bg-[var(--color-surface-raised)] border-[var(--color-border-strong)]"
                      : "text-[var(--color-secondary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <input
                    type="radio" name="practice_type" value={t.value}
                    checked={practiceType === t.value} onChange={() => setPracticeType(t.value)}
                    className="sr-only"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Practice size">
            <div className="grid grid-cols-2 gap-1.5">
              {SIZE_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors border ${
                    sizeTier === s.value
                      ? "text-[var(--color-primary)] bg-[var(--color-surface-raised)] border-[var(--color-border-strong)]"
                      : "text-[var(--color-secondary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <input
                    type="radio" name="size_tier" value={s.value}
                    checked={sizeTier === s.value} onChange={() => setSizeTier(s.value)}
                    className="sr-only"
                  />
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-tertiary)] mt-0.5">{s.help}</div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Frameworks to track">
            <div className="space-y-1.5">
              {FRAMEWORK_OPTIONS.map((f) => {
                const checked = frameworks.includes(f.code);
                return (
                  <label
                    key={f.code}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]"
                        : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface)]"
                    } ${f.required ? "cursor-default opacity-95" : ""}`}
                  >
                    <input
                      type="checkbox" checked={checked} disabled={f.required}
                      onChange={() => toggleFramework(f.code, f.required)}
                      className="accent-[var(--color-accent)] w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-[var(--color-primary)] text-sm font-medium">
                        {f.label}
                        {f.required && (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent)]">required</span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-tertiary)]">{f.help}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Field>

          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-quaternary)]">
            Signed in as <span className="text-[var(--color-tertiary)]">{userEmail}</span>. You become the owner.
          </p>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">{error}</div>
          )}

          <Button type="submit" loading={loading} disabled={!name.trim()} variant="primary" size="lg" className="w-full">
            Create practice → next step
          </Button>
        </form>

        <style>{`
          .onb-input {
            width: 100%; height: 38px; background: transparent;
            border: 1px solid var(--color-border-default); border-radius: 6px;
            padding: 0 10px; color: var(--color-primary); font-size: 14px;
            transition: border-color 150ms ease;
          }
          .onb-input:focus { border-color: var(--color-accent); outline: none; }
        `}</style>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}
